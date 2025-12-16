import { execAsync } from "./exec";

export type RemoteBranchUpdateStatus = {
    status: "upToDate" | "behind" | "ahead" | "diverged" | "noUpstream" | "notGit" | "unknown";
    branch?: string;
    upstream?: string | null;
    aheadCount?: number;
    behindCount?: number;
    fetched?: boolean;
    error?: string;
    checkedAt: string;
};

type CacheEntry = {
    value: RemoteBranchUpdateStatus;
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

async function computeAheadBehindAgainstUpstream(dir: string) {
    const { stdout } = await execAsync("git rev-list --left-right --count @{u}...HEAD", {
        cwd: dir,
        timeout: 2500,
        maxBuffer: 1024 * 1024,
    });
    const [behindRaw, aheadRaw] = stdout.trim().split(/\s+/);
    const aheadCount = Number.parseInt(aheadRaw ?? "0", 10) || 0;
    const behindCount = Number.parseInt(behindRaw ?? "0", 10) || 0;
    return { aheadCount, behindCount };
}

async function readRemoteBranchUpdateStatus(dir: string): Promise<RemoteBranchUpdateStatus> {
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
        const { stdout } = await execAsync("git rev-parse --abbrev-ref HEAD", {
            cwd: dir,
            timeout: 1500,
            maxBuffer: 1024 * 1024,
        });
        const branch = stdout.trim();
        if (!branch || branch === "HEAD") {
            return { status: "unknown", checkedAt };
        }

        let upstream: string | null = null;
        try {
            const { stdout: upstreamOut } = await execAsync("git rev-parse --abbrev-ref --symbolic-full-name @{u}", {
                cwd: dir,
                timeout: 1500,
                maxBuffer: 1024 * 1024,
            });
            upstream = upstreamOut.trim() || null;
        } catch {
            upstream = null;
        }

        if (!upstream) {
            return { status: "noUpstream", branch, upstream: null, checkedAt };
        }

        let fetched = false;
        try {
            const [remote, ...rest] = upstream.split("/");
            const upstreamBranch = rest.join("/");
            if (remote && upstreamBranch) {
                await execAsync(
                    `git fetch --quiet --prune ${JSON.stringify(remote)} ${JSON.stringify(upstreamBranch)}`,
                    {
                        cwd: dir,
                        timeout: 8000,
                        maxBuffer: 1024 * 1024,
                    },
                );
            } else {
                await execAsync("git fetch --quiet --prune", {
                    cwd: dir,
                    timeout: 8000,
                    maxBuffer: 1024 * 1024,
                });
            }
            fetched = true;
        } catch {
            fetched = false;
        }

        try {
            const { aheadCount, behindCount } = await computeAheadBehindAgainstUpstream(dir);
            if (aheadCount === 0 && behindCount === 0) {
                return { status: "upToDate", branch, upstream, fetched, aheadCount, behindCount, checkedAt };
            }
            if (aheadCount === 0 && behindCount > 0) {
                return { status: "behind", branch, upstream, fetched, aheadCount, behindCount, checkedAt };
            }
            if (aheadCount > 0 && behindCount === 0) {
                return { status: "ahead", branch, upstream, fetched, aheadCount, behindCount, checkedAt };
            }
            return { status: "diverged", branch, upstream, fetched, aheadCount, behindCount, checkedAt };
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to compare HEAD with upstream";
            return { status: "unknown", branch, upstream, fetched, error: message, checkedAt };
        }
    } catch {
        return { status: "unknown", checkedAt };
    }
}

export async function getRemoteBranchUpdateStatus(
    dir: string,
    options?: { ttlMs?: number },
): Promise<RemoteBranchUpdateStatus> {
    const ttlMs = options?.ttlMs ?? 60_000;
    const key = await repoCacheKey(dir);
    const now = Date.now();
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now) {
        return cached.value;
    }

    const value = await readRemoteBranchUpdateStatus(dir);
    cache.set(key, { value, expiresAt: now + ttlMs });
    return value;
}
