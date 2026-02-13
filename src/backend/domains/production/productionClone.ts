import fs from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { TEKTITE_PORT_FILE } from "../../../constants";
import { execAsync } from "../../exec";
import {
    cleanRepositoryUrl,
    cloneRepository,
    detectRepoChanges,
    sanitizeRepoName,
} from "../../git";
import { isWorkspaceActive } from "../../workspaceActivity";

export type ProductionCloneInfo = {
    path: string;
    exists: boolean;
    port: number | null;
    commitHash: string | null;
    commitDescription: string | null;
    hasChanges: boolean | null;
    inUse: boolean;
    mainBranchRemote: ProductionMainBranchStatus | null;
};

export type ProductionMainBranchStatus = {
    status:
        | "upToDate"
        | "behind"
        | "ahead"
        | "diverged"
        | "missingLocalMain"
        | "missingOriginMain"
        | "notGit"
        | "unknown";
    behindCount?: number;
    aheadCount?: number;
    fetched?: boolean;
    error?: string;
    checkedAt: string;
};

export function getProductionClonePath(repositoryUrl: string, productionDir: string) {
    const cleanUrl = cleanRepositoryUrl(repositoryUrl);
    const rawRepoName = path.basename(cleanUrl, ".git");
    const repoName = sanitizeRepoName(rawRepoName);
    return path.join(productionDir, repoName);
}

async function readHeadCommitSummary(
    dir: string,
): Promise<{ hash: string | null; description: string | null }> {
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

async function refExists(dir: string, refName: string): Promise<boolean> {
    try {
        await execAsync(`git rev-parse --verify --quiet ${JSON.stringify(refName)}`, {
            cwd: dir,
            timeout: 1500,
            maxBuffer: 1024 * 1024,
        });
        return true;
    } catch {
        return false;
    }
}

async function readMainBranchRemoteStatus(dir: string): Promise<ProductionMainBranchStatus> {
    const checkedAt = new Date().toISOString();

    try {
        await execAsync("git rev-parse --is-inside-work-tree", {
            cwd: dir,
            timeout: 1500,
            maxBuffer: 1024 * 1024,
        });
    } catch {
        return { status: "notGit", checkedAt };
    }

    let fetched = false;
    let fetchError: string | undefined;
    try {
        await execAsync("git fetch --quiet --prune origin main", {
            cwd: dir,
            timeout: 8000,
            maxBuffer: 1024 * 1024,
        });
        fetched = true;
    } catch (error) {
        fetched = false;
        fetchError = error instanceof Error ? error.message : String(error);
        console.warn("[production-clone] fetch origin main failed", { dir, fetchError });
    }

    const hasLocalMain = await refExists(dir, "refs/heads/main");
    if (!hasLocalMain) {
        return {
            status: "missingLocalMain",
            fetched,
            checkedAt,
            ...(fetchError ? { error: fetchError } : {}),
        };
    }

    const hasOriginMain = await refExists(dir, "refs/remotes/origin/main");
    if (!hasOriginMain) {
        return {
            status: "missingOriginMain",
            fetched,
            checkedAt,
            ...(fetchError ? { error: fetchError } : {}),
        };
    }

    try {
        const { stdout } = await execAsync("git rev-list --left-right --count origin/main...main", {
            cwd: dir,
            timeout: 2000,
            maxBuffer: 1024 * 1024,
        });
        const parts = stdout.trim().split(/\s+/);
        const behindCount = Number.parseInt(parts[0] ?? "0", 10) || 0;
        const aheadCount = Number.parseInt(parts[1] ?? "0", 10) || 0;

        if (behindCount === 0 && aheadCount === 0) {
            return {
                status: "upToDate",
                behindCount,
                aheadCount,
                fetched,
                checkedAt,
                ...(fetchError ? { error: fetchError } : {}),
            };
        }
        if (behindCount > 0 && aheadCount === 0) {
            return {
                status: "behind",
                behindCount,
                aheadCount,
                fetched,
                checkedAt,
                ...(fetchError ? { error: fetchError } : {}),
            };
        }
        if (behindCount === 0 && aheadCount > 0) {
            return {
                status: "ahead",
                behindCount,
                aheadCount,
                fetched,
                checkedAt,
                ...(fetchError ? { error: fetchError } : {}),
            };
        }
        return {
            status: "diverged",
            behindCount,
            aheadCount,
            fetched,
            checkedAt,
            ...(fetchError ? { error: fetchError } : {}),
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            status: "unknown",
            fetched,
            checkedAt,
            error: fetchError ? `${fetchError}; ${message}` : message,
        };
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
            mainBranchRemote: null,
        };
    }

    const [hasChanges, head, mainBranchRemote] = await Promise.all([
        detectRepoChanges(clonePath),
        readHeadCommitSummary(clonePath),
        readMainBranchRemoteStatus(clonePath),
    ]);
    return {
        path: clonePath,
        exists: true,
        port: readPortFile(clonePath),
        commitHash: head.hash,
        commitDescription: head.description,
        hasChanges,
        inUse: isWorkspaceActive(clonePath),
        mainBranchRemote,
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

export async function updateProductionCloneMain(options: {
    repositoryUrl: string;
    productionDir: string;
}): Promise<ProductionCloneInfo> {
    const clonePath = getProductionClonePath(options.repositoryUrl, options.productionDir);
    if (!fs.existsSync(clonePath)) {
        throw new Error("Production clone path does not exist.");
    }

    await execAsync("git checkout main", {
        cwd: clonePath,
        timeout: 10_000,
        maxBuffer: 1024 * 1024,
    });
    await execAsync("git pull --ff-only origin main", {
        cwd: clonePath,
        timeout: 20_000,
        maxBuffer: 1024 * 1024,
    });

    return getProductionCloneInfo(options);
}
