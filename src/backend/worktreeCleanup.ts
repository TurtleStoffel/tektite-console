import fs from "node:fs";
import path from "node:path";
import { isWorkspaceActive } from "./domains/worktrees/workspaceActivity";
import {
    detectRepoChanges,
    extractWorktreeRepoRoot,
    getPullRequestStatus,
    isWorktreeDir,
    removeWorktree,
} from "./git";

const PR_CLEANUP_JOB_NAME = "worktree-pr-cleanup";
const PR_CLEANUP_INTERVAL_MS = 30_000;

async function removeWorktreeIfEligible(worktreePath: string) {
    const worktreeName = path.basename(worktreePath);

    if (isWorkspaceActive(worktreePath)) {
        return;
    }

    const hasChanges = await detectRepoChanges(worktreePath);
    if (hasChanges) {
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

async function runPullRequestCleanup(clonesDir: string) {
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
        await removeWorktreeIfEligible(fullPath);
    }
}

export function startPullRequestCleanup(options: { clonesDir: string; intervalMs?: number }) {
    const { clonesDir } = options;
    const intervalMs = options.intervalMs ?? PR_CLEANUP_INTERVAL_MS;
    let running = false;

    const runner = async () => {
        if (running) return;
        running = true;

        try {
            await runPullRequestCleanup(clonesDir);
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
