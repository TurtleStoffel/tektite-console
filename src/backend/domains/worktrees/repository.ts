import fs from "node:fs";
import { isWorktreeDir } from "../../git";
import { isWithinRoot } from "../../http/pathUtils";
import { isWorkspaceActive } from "../../workspaceActivity";
import {
    getDevServerLogs,
    isDevInstallRunning,
    isDevServerRunning,
    startDevServer,
} from "./devServer";

export function isWithinClonesDir(clonesDir: string, worktreePath: string) {
    return isWithinRoot(worktreePath, clonesDir);
}

export function exists(worktreePath: string) {
    return fs.existsSync(worktreePath);
}

export function isWorktree(worktreePath: string) {
    return isWorktreeDir(worktreePath);
}

export function getLogs(worktreePath: string) {
    return getDevServerLogs(worktreePath);
}

export function isServerRunning(worktreePath: string) {
    return isDevServerRunning(worktreePath);
}

export function isInstallRunning(worktreePath: string) {
    return isDevInstallRunning(worktreePath);
}

export function isWorktreeActive(worktreePath: string) {
    return isWorkspaceActive(worktreePath);
}

export function startServer(worktreePath: string) {
    return startDevServer(worktreePath);
}
