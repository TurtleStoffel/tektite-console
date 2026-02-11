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

const LOG_PREFIX = "[remote-updates]";

function serializeError(error: unknown) {
    if (!error) return { message: "unknown error" };

    const anyError = error as any;
    const message = error instanceof Error ? error.message : String(error);
    const name = error instanceof Error ? error.name : undefined;

    const details: Record<string, unknown> = { message };
    if (name) details.name = name;
    if (typeof anyError?.code === "string" || typeof anyError?.code === "number")
        details.code = anyError.code;
    if (typeof anyError?.signal === "string") details.signal = anyError.signal;
    if (typeof anyError?.cmd === "string") details.cmd = anyError.cmd;
    if (typeof anyError?.stderr === "string") details.stderr = anyError.stderr.slice(0, 8000);
    if (typeof anyError?.stdout === "string") details.stdout = anyError.stdout.slice(0, 8000);

    return details;
}

function logInfo(message: string, meta?: Record<string, unknown>) {
    if (meta) {
        console.log(`${LOG_PREFIX} ${message}`, meta);
    } else {
        console.log(`${LOG_PREFIX} ${message}`);
    }
}

function logWarn(message: string, meta?: Record<string, unknown>) {
    if (meta) {
        console.warn(`${LOG_PREFIX} ${message}`, meta);
    } else {
        console.warn(`${LOG_PREFIX} ${message}`);
    }
}

async function repoCacheKey(dir: string): Promise<string> {
    try {
        const { stdout } = await execAsync("git rev-parse --show-toplevel", {
            cwd: dir,
            timeout: 1500,
            maxBuffer: 1024 * 1024,
        });
        const key = stdout.trim();
        if (key) return `toplevel:${key}`;
    } catch {
        // Fall back to absolute git dir.
    }

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
        // Fall back to the provided directory.
    }

    return `dir:${dir}`;
}

async function computeAheadBehindAgainstUpstream(dir: string) {
    const { stdout } = await execAsync("git rev-list --left-right --count @{u}...HEAD", {
        cwd: dir,
        timeout: 2500,
        maxBuffer: 1024 * 1024,
    });

    const parts = stdout.trim().split(/\s+/);
    const behindRaw = parts[0];
    const aheadRaw = parts[1];

    const aheadCount = Number.parseInt(aheadRaw ?? "0", 10) || 0;
    const behindCount = Number.parseInt(behindRaw ?? "0", 10) || 0;
    return { aheadCount, behindCount, raw: stdout.trim() };
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
            const { stdout: upstreamOut } = await execAsync(
                "git rev-parse --abbrev-ref --symbolic-full-name @{u}",
                {
                    cwd: dir,
                    timeout: 1500,
                    maxBuffer: 1024 * 1024,
                },
            );
            upstream = upstreamOut.trim() || null;
        } catch {
            upstream = null;
        }

        logInfo("status check", { dir, branch, upstream, checkedAt });

        if (!upstream) {
            return { status: "noUpstream", branch, upstream: null, checkedAt };
        }

        let fetched = false;
        let fetchError: string | null = null;
        try {
            const [remote, ...rest] = upstream.split("/");
            const upstreamBranch = rest.join("/");

            if (remote && upstreamBranch) {
                const cmd = `git fetch --quiet --prune ${JSON.stringify(remote)} ${JSON.stringify(upstreamBranch)}`;
                logInfo("fetching upstream", { dir, cmd, upstream });
                await execAsync(cmd, {
                    cwd: dir,
                    timeout: 8000,
                    maxBuffer: 1024 * 1024,
                });
            } else {
                const cmd = "git fetch --quiet --prune";
                logInfo("fetching all remotes", { dir, cmd, upstream });
                await execAsync(cmd, {
                    cwd: dir,
                    timeout: 8000,
                    maxBuffer: 1024 * 1024,
                });
            }

            fetched = true;
        } catch (error) {
            fetched = false;
            fetchError = serializeError(error).message;
            logWarn("git fetch failed", { dir, upstream, error: serializeError(error) });
        }

        try {
            const { aheadCount, behindCount, raw } = await computeAheadBehindAgainstUpstream(dir);

            const base: RemoteBranchUpdateStatus = {
                status: "unknown",
                branch,
                upstream,
                fetched,
                aheadCount,
                behindCount,
                checkedAt,
                ...(fetchError ? { error: `git fetch failed: ${fetchError}` } : {}),
            };

            logInfo("ahead/behind computed", {
                dir,
                branch,
                upstream,
                raw,
                aheadCount,
                behindCount,
                fetched,
                fetchError,
            });

            if (aheadCount === 0 && behindCount === 0) {
                return { ...base, status: "upToDate" };
            }
            if (aheadCount === 0 && behindCount > 0) {
                return { ...base, status: "behind" };
            }
            if (aheadCount > 0 && behindCount === 0) {
                return { ...base, status: "ahead" };
            }
            return { ...base, status: "diverged" };
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Failed to compare HEAD with upstream";
            logWarn("failed to compare HEAD with upstream", {
                dir,
                branch,
                upstream,
                fetched,
                fetchError,
                error: serializeError(error),
            });
            return {
                status: "unknown",
                branch,
                upstream,
                fetched,
                error: fetchError ? `git fetch failed: ${fetchError}; ${message}` : message,
                checkedAt,
            };
        }
    } catch (error) {
        logWarn("unexpected error while checking remote branch status", {
            dir,
            error: serializeError(error),
        });
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

    logInfo("cache miss", { dir, key, ttlMs });
    const value = await readRemoteBranchUpdateStatus(dir);
    logInfo("status result", {
        dir,
        key,
        status: value.status,
        branch: value.branch,
        upstream: value.upstream,
        aheadCount: value.aheadCount,
        behindCount: value.behindCount,
        fetched: value.fetched,
        error: value.error,
        checkedAt: value.checkedAt,
    });

    cache.set(key, { value, expiresAt: now + ttlMs });
    return value;
}
