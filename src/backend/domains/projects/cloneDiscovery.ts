import fs from "node:fs";
import path from "node:path";
import {
    cleanRepositoryUrl,
    detectRepoChanges,
    getPullRequestStatus,
    isWorktreeDir,
    sanitizeRepoName,
} from "@/backend/domains/git/service";
import { TEKTITE_PORT_FILE } from "../../../constants";
import { execAsync } from "../../exec";
import { getTerminalSessionByWorkspacePath } from "../worktrees/terminal";

type CloneLocation = "clonesDir";

type CloneInfo = {
    path: string;
    location: CloneLocation;
    port?: number | null;
    commitHash?: string | null;
    commitDescription?: string | null;
    isWorktree?: boolean;
    inUse: boolean;
    hasChanges?: boolean;
    prStatus?: Awaited<ReturnType<typeof getPullRequestStatus>>;
    promptSummary?: string | null;
};

function canonicalRepoId(repoUrl: string): string | null {
    const clean = cleanRepositoryUrl(repoUrl).trim();
    if (!clean) return null;

    const normalizePath = (rawPath: string) => {
        const trimmed = rawPath.replace(/^\/+/, "").replace(/\.git$/i, "");
        if (!trimmed) return null;
        return trimmed;
    };

    if (/^[a-zA-Z0-9._-]+@[^:]+:.+/.test(clean)) {
        const match = clean.match(/^([^@]+)@([^:]+):(.+)$/);
        if (!match) return null;
        const host = match[2]?.toLowerCase();
        const repoPath = normalizePath(match[3] ?? "");
        if (!host || !repoPath) return null;
        return `${host}/${repoPath}`.toLowerCase();
    }

    try {
        const parsed = new URL(clean);
        const host = parsed.host.toLowerCase();
        const repoPath = normalizePath(parsed.pathname);
        if (!host || !repoPath) return null;
        return `${host}/${repoPath}`.toLowerCase();
    } catch {
        return null;
    }
}

async function readOriginUrl(dir: string): Promise<string | null> {
    try {
        const { stdout } = await execAsync("git config --get remote.origin.url", {
            cwd: dir,
            timeout: 1500,
            maxBuffer: 1024 * 1024,
        });
        const value = stdout.trim();
        return value.length > 0 ? value : null;
    } catch {
        return null;
    }
}

function isCandidateGitDir(dir: string): boolean {
    try {
        const gitPath = path.join(dir, ".git");
        return fs.existsSync(gitPath);
    } catch {
        return false;
    }
}

function listImmediateDirectories(rootDir: string, limit: number): string[] {
    try {
        const entries = fs.readdirSync(rootDir, { withFileTypes: true });
        const dirs: string[] = [];
        for (const entry of entries) {
            if (dirs.length >= limit) break;
            if (!entry.isDirectory()) continue;
            if (entry.name.startsWith(".")) continue;
            if (entry.name === "node_modules") continue;
            dirs.push(path.join(rootDir, entry.name));
        }
        return dirs;
    } catch {
        return [];
    }
}

async function findMatchingReposInRoot(options: {
    rootDir: string;
    location: CloneLocation;
    repoId: string;
    maxDirs: number;
}): Promise<CloneInfo[]> {
    const { rootDir, location, repoId, maxDirs } = options;
    const dirs = listImmediateDirectories(rootDir, maxDirs).filter(isCandidateGitDir);
    const matches: CloneInfo[] = [];

    for (const dir of dirs) {
        const origin = await readOriginUrl(dir);
        if (!origin) continue;
        const originId = canonicalRepoId(origin);
        if (originId !== repoId) continue;
        matches.push({ path: dir, location, inUse: false });
    }

    return matches;
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

export async function findRepositoryClones(options: {
    repositoryUrl: string;
    clonesDir: string;
}): Promise<CloneInfo[]> {
    const repoId = canonicalRepoId(options.repositoryUrl);
    if (!repoId) return [];

    const rawRepoName = path.basename(cleanRepositoryUrl(options.repositoryUrl), ".git");
    const repoName = sanitizeRepoName(rawRepoName);
    const expectedBaseClone = path.join(options.clonesDir, repoName);

    const results: CloneInfo[] = [];
    const seen = new Set<string>();
    const record = (clone: CloneInfo) => {
        if (seen.has(clone.path)) return;
        seen.add(clone.path);
        results.push(clone);
    };

    if (fs.existsSync(expectedBaseClone)) {
        record({ path: expectedBaseClone, location: "clonesDir", inUse: false });
    }

    for (const dir of listImmediateDirectories(options.clonesDir, 500)) {
        const base = path.basename(dir);
        if (base === repoName || !base.startsWith(`${repoName}-`)) continue;
        if (!fs.existsSync(dir)) continue;
        record({ path: dir, location: "clonesDir", inUse: false });
    }

    const scanned = await Promise.all([
        findMatchingReposInRoot({
            rootDir: options.clonesDir,
            location: "clonesDir",
            repoId,
            maxDirs: 200,
        }),
    ]);
    for (const list of scanned) {
        for (const clone of list) record(clone);
    }

    results.sort((a, b) => a.path.localeCompare(b.path));
    const enriched = await Promise.all(
        results.map(async (clone) => {
            const isWorktree = isWorktreeDir(clone.path);
            const portPath = path.join(clone.path, TEKTITE_PORT_FILE);
            let port: number | null = null;
            try {
                if (fs.existsSync(portPath)) {
                    const portText = fs.readFileSync(portPath, "utf8").trim();
                    const parsed = Number.parseInt(portText, 10);
                    if (Number.isFinite(parsed)) {
                        port = parsed;
                    } else {
                        console.warn(
                            `Invalid ${TEKTITE_PORT_FILE} contents at ${portPath}: ${portText}`,
                        );
                    }
                }
            } catch (error) {
                console.warn(`Failed reading ${TEKTITE_PORT_FILE} at ${portPath}`, error);
            }

            const { hash, description } = await readHeadCommitSummary(clone.path);
            const [hasChanges, prStatus] = await Promise.all([
                detectRepoChanges(clone.path),
                isWorktree ? getPullRequestStatus(clone.path) : Promise.resolve(null),
            ]);

            return {
                ...clone,
                port,
                commitHash: hash,
                commitDescription: description,
                promptSummary: null,
                isWorktree,
                inUse: isWorktree ? Boolean(getTerminalSessionByWorkspacePath(clone.path)) : false,
                hasChanges,
                prStatus,
            };
        }),
    );

    return enriched;
}
