import { createBunAppRunner } from "./bunAppRunner";

const runner = createBunAppRunner({
    label: "dev server",
    nodeEnv: "development",
    startCommand: ["bun", "run", "dev"],
});

export function isDevServerRunning(worktreePath: string) {
    return runner.isServerRunning(worktreePath);
}

export function isDevInstallRunning(worktreePath: string) {
    return runner.isInstallRunning(worktreePath);
}

export function getDevServerLogs(worktreePath: string) {
    return runner.getLogs(worktreePath);
}

export function startDevServer(worktreePath: string) {
    return runner.start(worktreePath);
}
