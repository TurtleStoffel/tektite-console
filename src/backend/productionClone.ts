import fs from "node:fs";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { TEKTITE_PORT_FILE } from "../constants";
import { execAsync } from "./exec";
import { cleanRepositoryUrl, cloneRepository, detectRepoChanges, sanitizeRepoName } from "./git";
import { isWorkspaceActive } from "./workspaceActivity";

export type ProductionCloneInfo = {
    path: string;
    exists: boolean;
    port: number | null;
    commitHash: string | null;
    commitDescription: string | null;
    hasChanges: boolean | null;
    inUse: boolean;
};

export function getProductionClonePath(repositoryUrl: string, productionDir: string) {
    const cleanUrl = cleanRepositoryUrl(repositoryUrl);
    const rawRepoName = path.basename(cleanUrl, ".git");
    const repoName = sanitizeRepoName(rawRepoName);
    return path.join(productionDir, repoName);
}

async function readHeadCommitSummary(dir: string): Promise<{ hash: string | null; description: string | null }> {
    try {
        const { stdout } = await execAsync("git log -1 --pretty=format:%H%n%s", {
            cwd: dir,
            timeout: 1500,
            maxBuffer: 1024 * 1024,
        });

        const [hashLine, ...subjectParts] = stdout.split("\n");
        const hash = hashLine?.trim() ? hashLine.trim() : null;
        const description = subjectParts.join("\n").trim() ? subjectParts.join("\n").trim() : null;
        return { hash, description };
    } catch {
        return { hash: null, description: null };
    }
}

function readPortFile(dir: string): number | null {
    const portPath = path.join(dir, TEKTITE_PORT_FILE);
    try {
        if (!fs.existsSync(portPath)) return null;
        const portText = fs.readFileSync(portPath, "utf8").trim();
        const parsed = Number.parseInt(portText, 10);
        return Number.isFinite(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

export async function getProductionCloneInfo(options: {
    repositoryUrl: string;
    productionDir: string;
}): Promise<ProductionCloneInfo> {
    const clonePath = getProductionClonePath(options.repositoryUrl, options.productionDir);
    const exists = fs.existsSync(clonePath);

    if (!exists) {
        return {
            path: clonePath,
            exists: false,
            port: null,
            commitHash: null,
            commitDescription: null,
            hasChanges: null,
            inUse: false,
        };
    }

    const [hasChanges, head] = await Promise.all([detectRepoChanges(clonePath), readHeadCommitSummary(clonePath)]);
    return {
        path: clonePath,
        exists: true,
        port: readPortFile(clonePath),
        commitHash: head.hash,
        commitDescription: head.description,
        hasChanges,
        inUse: isWorkspaceActive(clonePath),
    };
}

export async function ensureProductionClone(options: {
    repositoryUrl: string;
    productionDir: string;
}): Promise<{ clonePath: string }> {
    const clonePath = getProductionClonePath(options.repositoryUrl, options.productionDir);
    await mkdir(options.productionDir, { recursive: true });
    if (!fs.existsSync(clonePath)) {
        const cleanUrl = cleanRepositoryUrl(options.repositoryUrl);
        await cloneRepository(cleanUrl, clonePath);
    }
    return { clonePath };
}
