import path from "node:path";
import * as repository from "./repository";

export function createWorktreesService(options: { clonesDir: string }) {
    const { clonesDir } = options;

    return {
        getDevLogs(rawPath: string) {
            const worktreePath = path.resolve(rawPath);
            if (!repository.isWithinClonesDir(clonesDir, worktreePath)) {
                return {
                    error: "Worktree path is outside configured folders.",
                    status: 403 as const,
                };
            }
            if (!repository.exists(worktreePath)) {
                return { error: "Worktree path does not exist.", status: 404 as const };
            }
            if (!repository.isWorktree(worktreePath)) {
                return { error: "Path is not a git worktree.", status: 400 as const };
            }

            const logs = repository.getLogs(worktreePath);
            return {
                path: worktreePath,
                exists: true,
                running: logs.running,
                installing: logs.installing,
                lines: logs.lines,
                partial: logs.partial,
            };
        },

        startDevServer(rawPath: string) {
            const worktreePath = path.resolve(rawPath);
            if (!repository.isWithinClonesDir(clonesDir, worktreePath)) {
                return {
                    error: "Worktree path is outside configured folders.",
                    status: 403 as const,
                };
            }
            if (!repository.exists(worktreePath)) {
                return { error: "Worktree path does not exist.", status: 404 as const };
            }
            if (!repository.isWorktree(worktreePath)) {
                return { error: "Path is not a git worktree.", status: 400 as const };
            }

            if (
                repository.isServerRunning(worktreePath) ||
                repository.isInstallRunning(worktreePath)
            ) {
                return repository.startServer(worktreePath);
            }

            if (repository.isWorktreeActive(worktreePath)) {
                return { error: "Worktree is already active.", status: 409 as const };
            }

            try {
                return repository.startServer(worktreePath);
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : "Failed to start dev server.";
                return { error: message, status: 500 as const };
            }
        },
    };
}
