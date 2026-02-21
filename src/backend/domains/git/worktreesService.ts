import path from "node:path";
import { startPullRequestCleanup as startPullRequestCleanupJob } from "./cleanup";
import * as repository from "./repository";
import { startOrReuseTerminal } from "./terminal";

export function createWorktreesService(options: { clonesDir: string }) {
    const allowedRoots = [options.clonesDir];

    return {
        startDevTerminal(rawPath: string) {
            const worktreePath = path.resolve(rawPath);
            if (!repository.isWithinAnyRoot(allowedRoots, worktreePath)) {
                return {
                    error: "Worktree path is outside configured folders.",
                    status: 403 as const,
                };
            }
            if (!repository.exists(worktreePath)) {
                return { error: "Worktree path does not exist.", status: 404 as const };
            }
            if (!repository.isGitRepository(worktreePath)) {
                return { error: "Path is not a git clone.", status: 400 as const };
            }

            try {
                return startOrReuseTerminal(worktreePath);
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : "Failed to start dev terminal.";
                return { error: message, status: 500 as const };
            }
        },
    };
}

export function startPullRequestCleanup(options: { clonesDir: string; intervalMs?: number }) {
    return startPullRequestCleanupJob(options);
}
