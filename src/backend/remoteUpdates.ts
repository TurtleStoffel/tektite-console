import { execAsync } from "./exec";

export type RemoteMainUpdateStatus = {
    status: "upToDate" | "behind" | "ahead" | "diverged" | "noOrigin" | "noLocalMain" | "notGit" | "unknown";
    aheadCount?: number;
    behindCount?: number;
    fetched?: boolean;
    error?: string;
    checkedAt: string;
};

type CacheEntry = {
    value: RemoteMainUpdateStatus;
    expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

async function repoCacheKey(dir: string): Promise<string> {
    try {
        const { stdout } = await execAsync("git rev-parse --absolute-git-dir", {
            cwd: dir,
            timeout: 1500,
            maxBuffer: 1024 * 1024,
        });
        const key = stdout.trim();
        if (key) return `absolute-git-dir:${key}`;
    } catch {
        // Fall back to common dir.
    }

    try {
        const { stdout } = await execAsync("git rev-parse --git-common-dir", {
            cwd: dir,
            timeout: 1500,
            maxBuffer: 1024 * 1024,
        });
        const key = stdout.trim();
        if (key) return `git-common-dir:${key}`;
    } catch {
        // Fall back to toplevel.
    }

    try {
        const { stdout } = await execAsync("git rev-parse --show-toplevel", {
            cwd: dir,
            timeout: 1500,
            maxBuffer: 1024 * 1024,
        });
        const key = stdout.trim();
        if (key) return `toplevel:${key}`;
    } catch {
        // Fall back to the provided directory.
    }

    return `dir:${dir}`;
}

async function hasRef(dir: string, ref: string) {
    try {
        await execAsync(`git show-ref --verify --quiet ${ref}`, {
            cwd: dir,
            timeout: 1500,
            maxBuffer: 1024 * 1024,
        });
        return true;
    } catch {
        return false;
    }
}

async function computeAheadBehind(dir: string) {
    const { stdout } = await execAsync("git rev-list --left-right --count main...origin/main", {
        cwd: dir,
        timeout: 2500,
        maxBuffer: 1024 * 1024,
    });
    const [aheadRaw, behindRaw] = stdout.trim().split(/\s+/);
    const aheadCount = Number.parseInt(aheadRaw ?? "0", 10) || 0;
    const behindCount = Number.parseInt(behindRaw ?? "0", 10) || 0;
    return { aheadCount, behindCount };
}

async function readRemoteMainUpdateStatus(dir: string): Promise<RemoteMainUpdateStatus> {
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

    try {
        await execAsync("git remote get-url origin", {
            cwd: dir,
            timeout: 1500,
            maxBuffer: 1024 * 1024,
        });
    } catch {
        return { status: "noOrigin", checkedAt };
    }

    const hasLocalMain = await hasRef(dir, "refs/heads/main");
    if (!hasLocalMain) {
        return { status: "noLocalMain", checkedAt };
    }

    let fetched = false;
    try {
        await execAsync("git fetch --quiet origin main", {
            cwd: dir,
            timeout: 8000,
            maxBuffer: 1024 * 1024,
        });
        fetched = true;
    } catch {
        fetched = false;
    }

    const hasOriginMain = await hasRef(dir, "refs/remotes/origin/main");
    if (!hasOriginMain) {
        return { status: "unknown", fetched, checkedAt };
    }

    try {
        const { aheadCount, behindCount } = await computeAheadBehind(dir);
        if (aheadCount === 0 && behindCount === 0) {
            return { status: "upToDate", fetched, aheadCount, behindCount, checkedAt };
        }
        if (aheadCount === 0 && behindCount > 0) {
            return { status: "behind", fetched, aheadCount, behindCount, checkedAt };
        }
        if (aheadCount > 0 && behindCount === 0) {
            return { status: "ahead", fetched, aheadCount, behindCount, checkedAt };
        }
        return { status: "diverged", fetched, aheadCount, behindCount, checkedAt };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to compare main with origin/main";
        return { status: "unknown", fetched, error: message, checkedAt };
    }
}

export async function getRemoteMainUpdateStatus(dir: string, options?: { ttlMs?: number }): Promise<RemoteMainUpdateStatus> {
    const ttlMs = options?.ttlMs ?? 60_000;
    const key = await repoCacheKey(dir);
    const now = Date.now();
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now) {
        return cached.value;
    }

    const value = await readRemoteMainUpdateStatus(dir);
    cache.set(key, { value, expiresAt: now + ttlMs });
    return value;
}
