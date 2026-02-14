import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { type ExecError, execAsync, execFileAsync, isExecTimeoutError } from "./exec";

type PullRequestState = "open" | "closed" | "merged" | "draft" | "none" | "unknown";

type PullRequestStatus = {
    state: PullRequestState;
    number?: number;
    title?: string;
    url?: string;
};

export function sanitizeRepoName(name: string) {
    return name.replace(/[^a-zA-Z0-9-_]/g, "-");
}

export async function detectRepoChanges(dir: string): Promise<boolean> {
    try {
        const { stdout } = await execAsync("git status --porcelain", {
            cwd: dir,
            timeout: 2500,
            maxBuffer: 1024 * 1024,
        });
        return stdout.trim().length > 0;
    } catch {
        return false;
    }
}

export async function getPullRequestStatus(dir: string): Promise<PullRequestStatus | null> {
    const branchStatus = await getBranchStatus(dir);
    if (!branchStatus) {
        return null;
    }

    const branch = branchStatus.branch;
    if (!branch || branch === "HEAD") {
        return null;
    }

    try {
        const { stdout } = await execFileAsync(
            "gh",
            [
                "pr",
                "list",
                "--state",
                "all",
                "--head",
                branch,
                "--json",
                "number,state,title,url,mergedAt,isDraft",
                "--limit",
                "1",
            ],
            {
                cwd: dir,
                timeout: 15_000,
                maxBuffer: 1024 * 1024,
            },
        );
        const parsed = JSON.parse(stdout);
        if (!Array.isArray(parsed) || parsed.length === 0) {
            return { state: "none" };
        }

        const [pr] = parsed as Array<{
            number?: number;
            state?: string;
            title?: string;
            url?: string;
            mergedAt?: string | null;
            isDraft?: boolean;
        }>;

        const state = typeof pr.state === "string" ? pr.state.toLowerCase() : "unknown";
        let mappedState: PullRequestState = "unknown";

        if (state === "open") {
            mappedState = pr.isDraft ? "draft" : "open";
        } else if (state === "closed") {
            mappedState = pr.mergedAt ? "merged" : "closed";
        } else if (state === "merged") {
            mappedState = "merged";
        }

        return {
            state: mappedState,
            number: typeof pr.number === "number" ? pr.number : undefined,
            title: typeof pr.title === "string" ? pr.title : undefined,
            url: typeof pr.url === "string" ? pr.url : undefined,
        };
    } catch (error) {
        if (isExecTimeoutError(error)) {
            return { state: "unknown" };
        }

        const execError = error as ExecError;
        if (execError.code === "ENOENT") {
            console.warn(
                `Failed to read PR status for branch ${branch}; GitHub CLI (gh) not found.`,
            );
            return { state: "unknown" };
        }

        console.warn(`Failed to read PR status for branch ${branch}`, error);
        return { state: "unknown" };
    }
}

async function resolveDefaultBranch(baseDir: string): Promise<string> {
    try {
        const { stdout } = await execAsync("git symbolic-ref refs/remotes/origin/HEAD", {
            cwd: baseDir,
        });
        const match = stdout.trim().match(/^refs\/remotes\/origin\/(.+)$/);
        if (match?.[1]) {
            return match[1];
        }
    } catch {
        // Fall through to common branch names.
    }

    for (const candidate of ["main", "master"]) {
        try {
            await execAsync(`git show-ref --verify --quiet refs/remotes/origin/${candidate}`, {
                cwd: baseDir,
            });
            return candidate;
        } catch {}
    }

    return "main";
}

async function updateBaseRepo(baseDir: string): Promise<string> {
    await execAsync("git fetch --all --prune", { cwd: baseDir });
    return resolveDefaultBranch(baseDir);
}

async function cloneRepository(repoUrl: string, targetDir: string) {
    const quotedUrl = JSON.stringify(repoUrl);
    const quotedTargetDir = JSON.stringify(targetDir);
    await mkdir(path.dirname(targetDir), { recursive: true });
    await execAsync(`git clone ${quotedUrl} ${quotedTargetDir}`);
}

async function createWorktree(baseDir: string, repoName: string, clonesDir: string) {
    const defaultBranch = await updateBaseRepo(baseDir);
    const uniqueId = randomUUID();
    const worktreeName = `${repoName}-${uniqueId}`;
    const worktreePath = path.join(clonesDir, worktreeName);
    const branchName = worktreeName;
    const quotedPath = JSON.stringify(worktreePath);

    await execAsync(`git worktree add -b ${branchName} ${quotedPath} origin/${defaultBranch}`, {
        cwd: baseDir,
    });

    return { worktreePath, branchName };
}

export async function removeWorktree(worktreePath: string, repoRoot: string, branchName?: string) {
    const quotedPath = JSON.stringify(worktreePath);
    await execAsync(`git worktree remove --force ${quotedPath}`, { cwd: repoRoot });

    if (!branchName) {
        return;
    }

    try {
        await execAsync(`git branch -D ${JSON.stringify(branchName)}`, { cwd: repoRoot });
    } catch {
        // Best-effort branch cleanup.
    }
}

export function cleanRepositoryUrl(repoUrl: string) {
    return repoUrl.replace(/^git\+/, "");
}

export async function prepareWorktree(repoUrl: string, clonesDir: string) {
    const cleanUrl = cleanRepositoryUrl(repoUrl);
    const rawRepoName = path.basename(cleanUrl, ".git");
    const repoName = sanitizeRepoName(rawRepoName);
    const baseDir = path.join(clonesDir, repoName);

    await mkdir(clonesDir, { recursive: true });

    if (!fs.existsSync(baseDir)) {
        await cloneRepository(cleanUrl, baseDir);
    }

    const { worktreePath, branchName } = await createWorktree(baseDir, repoName, clonesDir);

    return { worktreePath, repoName, baseDir, branchName };
}

export async function ensureClonesDir(clonesDir: string) {
    await mkdir(clonesDir, { recursive: true });
}

async function getBranchStatus(
    dir: string,
): Promise<{ branch: string; upstream: string | null; aheadCount: number } | null> {
    try {
        await execAsync("git rev-parse --is-inside-work-tree", { cwd: dir });
        const { stdout: branchOut } = await execAsync("git rev-parse --abbrev-ref HEAD", {
            cwd: dir,
        });
        const branch = branchOut.trim();
        if (!branch || branch === "HEAD") {
            return null;
        }

        let upstream: string | null = null;
        try {
            const { stdout: upstreamOut } = await execAsync(
                "git rev-parse --abbrev-ref --symbolic-full-name @{u}",
                {
                    cwd: dir,
                },
            );
            upstream = upstreamOut.trim() || null;
        } catch {
            upstream = null;
        }

        let aheadCount = 0;
        if (upstream) {
            try {
                const { stdout: aheadOut } = await execAsync(
                    "git rev-list --left-right --count @{u}...HEAD",
                    {
                        cwd: dir,
                    },
                );
                const parts = aheadOut.trim().split(/\s+/);
                aheadCount = Number.parseInt(parts[1] ?? "0", 10) || 0;
            } catch {
                aheadCount = 0;
            }
        } else {
            try {
                const { stdout: headOut } = await execAsync("git rev-parse --verify HEAD", {
                    cwd: dir,
                });
                if (headOut.trim()) {
                    aheadCount = 1;
                }
            } catch {
                aheadCount = 0;
            }
        }

        return { branch, upstream, aheadCount };
    } catch (error) {
        console.warn("Skipping git push/PR; not a git repo", error);
        return null;
    }
}

async function ensurePushed(dir: string, branch: string, upstream: string | null) {
    const upstreamBranch = upstream?.split("/").pop();
    const shouldResetUpstream = !upstream || upstreamBranch !== branch;
    const pushCmd = shouldResetUpstream ? `git push -u origin ${branch}` : "git push";

    console.log(
        `[codex] pushing branch ${branch}${shouldResetUpstream ? ` (setting upstream to origin/${branch})` : ""}`,
    );
    await execAsync(pushCmd, { cwd: dir });
}

async function prExists(dir: string, branch: string) {
    try {
        const { stdout } = await execFileAsync(
            "gh",
            ["pr", "list", "--state", "all", "--head", branch, "--json", "number", "--limit", "1"],
            { cwd: dir, timeout: 15_000, maxBuffer: 1024 * 1024 },
        );
        const parsed = JSON.parse(stdout);
        return Array.isArray(parsed) && parsed.length > 0;
    } catch (error) {
        if (isExecTimeoutError(error)) {
            return true;
        }
        console.warn("Failed to check PR existence", error);
        return true;
    }
}

async function ensurePullRequest(dir: string, branch: string) {
    const exists = await prExists(dir, branch);
    if (exists) {
        return;
    }

    console.log(`[codex] creating pull request for branch ${branch}`);
    await execFileAsync("gh", ["pr", "create", "--fill", "--head", branch], {
        cwd: dir,
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
    });
}

async function readCommitMessage(workingDirectory: string): Promise<string | null> {
    const commitDetailsPath = path.join(workingDirectory, "commit-details.txt");
    if (!fs.existsSync(commitDetailsPath)) {
        return null;
    }

    try {
        const raw = fs.readFileSync(commitDetailsPath, "utf8").trim();
        return raw.length > 0 ? raw : null;
    } catch (error) {
        console.warn("Failed to read commit-details.txt", error);
        return null;
    } finally {
        try {
            fs.rmSync(commitDetailsPath);
        } catch (error) {
            console.warn("Failed to remove commit-details.txt", error);
        }
    }
}

async function hasStagedChanges(dir: string) {
    try {
        await execAsync("git diff --cached --quiet", { cwd: dir });
        return false;
    } catch {
        return true;
    }
}

async function maybeCommitChanges(workingDirectory: string) {
    const commitMessage = (await readCommitMessage(workingDirectory)) ?? "Codex changes";
    const quotedMessage = JSON.stringify(commitMessage);

    try {
        await execAsync("git add -A", { cwd: workingDirectory });
    } catch (error) {
        console.warn("Failed to stage changes before commit", error);
        return;
    }

    const staged = await hasStagedChanges(workingDirectory);
    if (!staged) {
        return;
    }

    try {
        await execAsync(`git commit -m ${quotedMessage}`, { cwd: workingDirectory });
    } catch (error) {
        console.warn("Failed to create commit", error);
    }
}

export async function finalizeGitState(workingDirectory?: string | null) {
    if (!workingDirectory) {
        return;
    }

    await maybeCommitChanges(workingDirectory);

    const status = await getBranchStatus(workingDirectory);
    if (!status) {
        return;
    }

    try {
        if (status.aheadCount > 0) {
            await ensurePushed(workingDirectory, status.branch, status.upstream);
        }
    } catch (error) {
        console.warn("Failed to push changes", error);
        return;
    }

    try {
        await ensurePullRequest(workingDirectory, status.branch);
    } catch (error) {
        console.warn("Failed to create PR", error);
    }
}

export function isWorktreeDir(dir: string) {
    try {
        const stat = fs.lstatSync(path.join(dir, ".git"));
        return stat.isFile();
    } catch {
        return false;
    }
}

export function extractWorktreeRepoRoot(worktreePath: string) {
    const gitPointerPath = path.join(worktreePath, ".git");

    try {
        const gitPointer = fs.readFileSync(gitPointerPath, "utf8");
        const match = gitPointer.match(/gitdir:\s*(.+)/i);
        if (!match) {
            return null;
        }

        const gitDir = match[1].trim();
        const absoluteGitDir = path.isAbsolute(gitDir)
            ? gitDir
            : path.resolve(worktreePath, gitDir);
        const worktreesDir = path.dirname(absoluteGitDir); // .../.git/worktrees
        const baseGitDir = path.dirname(worktreesDir); // .../.git
        const repoRoot = path.dirname(baseGitDir);

        if (!fs.existsSync(baseGitDir) || !fs.lstatSync(baseGitDir).isDirectory()) {
            return null;
        }

        return { repoRoot, worktreeGitDir: absoluteGitDir };
    } catch {
        return null;
    }
}
