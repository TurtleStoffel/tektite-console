import { markWorkspaceActive, markWorkspaceInactive } from "./workspaceActivity";

const devServers = new Map<string, Bun.Process>();

export function isDevServerRunning(worktreePath: string) {
    return devServers.has(worktreePath);
}

export function startDevServer(worktreePath: string) {
    const existing = devServers.get(worktreePath);
    if (existing) {
        return { status: "already-running" as const, pid: existing.pid };
    }

    const process = Bun.spawn(["bun", "run", "dev"], {
        cwd: worktreePath,
        stdin: "ignore",
        stdout: "ignore",
        stderr: "pipe",
        env: {
            ...Bun.env,
            NODE_ENV: "development",
        },
    });

    devServers.set(worktreePath, process);
    markWorkspaceActive(worktreePath);

    void process.exited.then(() => {
        const current = devServers.get(worktreePath);
        if (current === process) {
            devServers.delete(worktreePath);
            markWorkspaceInactive(worktreePath);
        }
    });

    return { status: "started" as const, pid: process.pid };
}

