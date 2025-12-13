import fs from "fs";
import path from "path";
import { execAsync } from "./exec";
import { cleanRepositoryUrl, sanitizeRepoName } from "./git";
import { TEKTITE_PORT_FILE } from "../constants";

export type CloneLocation = "clonesDir" | "codingFolder";

export type CloneInfo = {
    path: string;
    location: CloneLocation;
    port?: number | null;
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
        matches.push({ path: dir, location });
    }

    return matches;
}

export async function findRepositoryClones(options: {
    repositoryUrl: string;
    clonesDir: string;
    codingFolder: string;
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
        record({ path: expectedBaseClone, location: "clonesDir" });
    }

    for (const dir of listImmediateDirectories(options.clonesDir, 500)) {
        const base = path.basename(dir);
        if (base === repoName || !base.startsWith(`${repoName}-`)) continue;
        if (!fs.existsSync(dir)) continue;
        record({ path: dir, location: "clonesDir" });
    }

    const directCodingCandidate = path.join(options.codingFolder, rawRepoName);
    if (fs.existsSync(directCodingCandidate)) {
        record({ path: directCodingCandidate, location: "codingFolder" });
    }

    const scanned = await Promise.all([
        findMatchingReposInRoot({ rootDir: options.clonesDir, location: "clonesDir", repoId, maxDirs: 200 }),
        findMatchingReposInRoot({ rootDir: options.codingFolder, location: "codingFolder", repoId, maxDirs: 200 }),
    ]);
    for (const list of scanned) {
        for (const clone of list) record(clone);
    }

    results.sort((a, b) => a.path.localeCompare(b.path));

    return results.map((clone) => {
        const portPath = path.join(clone.path, TEKTITE_PORT_FILE);
        try {
            if (!fs.existsSync(portPath)) return { ...clone, port: null };
            const portText = fs.readFileSync(portPath, "utf8").trim();
            const port = Number.parseInt(portText, 10);
            if (!Number.isFinite(port)) {
                console.warn(`Invalid ${TEKTITE_PORT_FILE} contents at ${portPath}: ${portText}`);
                return { ...clone, port: null };
            }
            return { ...clone, port };
        } catch (error) {
            console.warn(`Failed reading ${TEKTITE_PORT_FILE} at ${portPath}`, error);
            return { ...clone, port: null };
        }
    });
}
