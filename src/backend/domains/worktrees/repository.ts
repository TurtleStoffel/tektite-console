import fs from "node:fs";
import path from "node:path";
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

export function isWithinAnyRoot(roots: string[], worktreePath: string) {
    return roots.some((root) => isWithinRoot(worktreePath, root));
}

export function exists(worktreePath: string) {
    return fs.existsSync(worktreePath);
}

export function isWorktree(worktreePath: string) {
    return isWorktreeDir(worktreePath);
}

export function isGitRepository(worktreePath: string) {
    const gitPath = path.join(worktreePath, ".git");
    try {
        const stat = fs.lstatSync(gitPath);
        return stat.isDirectory() || stat.isFile();
    } catch {
        return false;
    }
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
