import fs from "node:fs";
import path from "node:path";
import {
    detectRepoChanges,
    extractWorktreeRepoRoot,
    getPullRequestStatus,
    hasUnpushedCommits,
    isWorktreeDir,
    removeWorktree,
} from "@/backend/domains/git/service";
import { tasksService } from "@/backend/domains/tasks/service";
import { isWorktreeInUse } from "./workspaceActivity";

const PR_CLEANUP_JOB_NAME = "worktree-pr-cleanup";
const PR_CLEANUP_INTERVAL_MS = 30_000;
const PR_CLEANUP_MIN_WORKTREE_AGE_MS = 5 * 60_000;

function isWorktreeOlderThan(worktreePath: string, minAgeMs: number) {
    if (minAgeMs <= 0) {
        return true;
    }

    try {
        const stats = fs.statSync(worktreePath);
        const createdAtMs = stats.birthtimeMs > 0 ? stats.birthtimeMs : stats.ctimeMs;
        const ageMs = Date.now() - createdAtMs;
        return ageMs >= minAgeMs;
    } catch (error) {
        console.warn(
            `[${PR_CLEANUP_JOB_NAME}] Failed reading worktree age for ${worktreePath}`,
            error,
        );
        return false;
    }
}

async function removeWorktreeIfEligible(worktreePath: string, minWorktreeAgeMs: number) {
    const worktreeName = path.basename(worktreePath);

    if (!isWorktreeOlderThan(worktreePath, minWorktreeAgeMs)) {
        return;
    }

    if (isWorktreeInUse(worktreePath)) {
        return;
    }

    const hasChanges = await detectRepoChanges(worktreePath);
    if (hasChanges) {
        return;
    }

    const unpushedCommits = await hasUnpushedCommits(worktreePath);
    if (unpushedCommits === null) {
        console.warn(
            `[${PR_CLEANUP_JOB_NAME}] Skipping removal for ${worktreeName}; unable to determine unpushed commit status.`,
        );
        return;
    }
    if (unpushedCommits) {
        console.log(
            `[${PR_CLEANUP_JOB_NAME}] Skipping removal for ${worktreeName}; branch has unpushed commits.`,
        );
        return;
    }

    const worktreeInfo = extractWorktreeRepoRoot(worktreePath);
    if (!worktreeInfo) {
        console.warn(`[${PR_CLEANUP_JOB_NAME}] Could not resolve repo root for ${worktreePath}`);
        return;
    }

    const prStatus = await getPullRequestStatus(worktreePath);
    if (!prStatus) {
        return;
    }

    if (prStatus.state === "open" || prStatus.state === "draft") {
        return;
    }

    if (prStatus.state === "unknown") {
        return;
    }

    try {
        console.log(
            `[${PR_CLEANUP_JOB_NAME}] Removing ${worktreeName}; clean + idle (pr=${prStatus.state}).`,
        );
        await removeWorktree(worktreePath, worktreeInfo.repoRoot, worktreeName);
    } catch (error) {
        console.warn(`[${PR_CLEANUP_JOB_NAME}] Failed to remove worktree ${worktreeName}`, error);
        return;
    }

    try {
        const doneResult = await tasksService.markTasksDoneByWorktreePath(worktreePath);
        if (doneResult.totalMarkedDone > 0) {
            console.info(`[${PR_CLEANUP_JOB_NAME}] Marked linked tasks done`, {
                worktreePath,
                totalMatched: doneResult.totalMatched,
                totalMarkedDone: doneResult.totalMarkedDone,
            });
        }
    } catch (error) {
        console.warn(
            `[${PR_CLEANUP_JOB_NAME}] Failed to mark linked tasks done for ${worktreeName}`,
            error,
        );
    }

    try {
        if (fs.existsSync(worktreePath)) {
            fs.rmSync(worktreePath, { recursive: true, force: true });
        }
    } catch (error) {
        console.warn(
            `[${PR_CLEANUP_JOB_NAME}] Worktree detached but could not delete directory ${worktreePath}`,
            error,
        );
    }
}

async function runPullRequestCleanup(clonesDir: string, minWorktreeAgeMs: number) {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(clonesDir, { withFileTypes: true });
    } catch (error) {
        console.warn(`[${PR_CLEANUP_JOB_NAME}] Unable to read clones directory`, error);
        return;
    }

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const fullPath = path.join(clonesDir, entry.name);
        if (!isWorktreeDir(fullPath)) continue;
        await removeWorktreeIfEligible(fullPath, minWorktreeAgeMs);
    }
}

export function startPullRequestCleanup(options: { clonesDir: string; intervalMs?: number }) {
    const { clonesDir } = options;
    const intervalMs = options.intervalMs ?? PR_CLEANUP_INTERVAL_MS;
    const minWorktreeAgeMs = PR_CLEANUP_MIN_WORKTREE_AGE_MS;
    let running = false;

    const runner = async () => {
        if (running) return;
        running = true;

        try {
            await runPullRequestCleanup(clonesDir, minWorktreeAgeMs);
        } catch (error) {
            console.warn(`[${PR_CLEANUP_JOB_NAME}] Job failed`, error);
        } finally {
            running = false;
        }
    };

    const interval = setInterval(() => {
        void runner();
    }, intervalMs);

    void runner();

    return () => clearInterval(interval);
}
