import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { execAsync, isExecTimeoutError } from "../../exec";
import {
    isWorktreeInUse,
    markCodexWorkspaceActive,
    markCodexWorkspaceInactive,
} from "./workspaceActivity";

export { isWorktreeInUse };
export const markAgentWorkspaceActive = markCodexWorkspaceActive;
export const markAgentWorkspaceInactive = markCodexWorkspaceInactive;

type PullRequestState = "open" | "closed" | "merged" | "draft" | "none" | "unknown";

type PullRequestStatus = {
    state: PullRequestState;
    number?: number;
    title?: string;
    url?: string;
};

type GithubRepoRef = {
    owner: string;
    repo: string;
};

type GithubPullRequest = {
    number?: number;
    title?: string;
    html_url?: string;
    state?: string;
    draft?: boolean;
    merged_at?: string | null;
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
        const repoRef = await getGithubRepoRef(dir);
        if (!repoRef) {
            return { state: "none" };
        }
        const pullRequests = await fetchPullRequestsByHead(repoRef, branch, "all");
        const [pr] = pullRequests;
        if (!pr) {
            return { state: "none" };
        }

        const state = typeof pr.state === "string" ? pr.state.toLowerCase() : "unknown";
        let mappedState: PullRequestState = "unknown";

        if (state === "open") {
            mappedState = pr.draft ? "draft" : "open";
        } else if (state === "closed") {
            mappedState = pr.merged_at ? "merged" : "closed";
        } else if (state === "merged") {
            mappedState = "merged";
        }

        return {
            state: mappedState,
            number: typeof pr.number === "number" ? pr.number : undefined,
            title: typeof pr.title === "string" ? pr.title : undefined,
            url: typeof pr.html_url === "string" ? pr.html_url : undefined,
        };
    } catch (error) {
        if (isExecTimeoutError(error)) {
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
        const resolvedDefaultBranch = match?.[1];
        if (resolvedDefaultBranch) {
            return resolvedDefaultBranch;
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

export async function hasUnpushedCommits(dir: string): Promise<boolean | null> {
    const status = await getBranchStatus(dir);
    if (!status) {
        return null;
    }
    return status.aheadCount > 0;
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
        const repoRef = await getGithubRepoRef(dir);
        if (!repoRef) {
            return true;
        }
        const pullRequests = await fetchPullRequestsByHead(repoRef, branch, "all");
        return pullRequests.length > 0;
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

    const repoRef = await getGithubRepoRef(dir);
    if (!repoRef) {
        console.warn(
            `[codex] skipping PR creation for ${branch}; unable to resolve GitHub repository`,
        );
        return;
    }

    const defaultBranch = await resolveDefaultBranch(dir);
    const title = await getPullRequestTitle(dir, branch);
    const body = await getPullRequestBody(dir);

    console.log(`[codex] creating pull request for branch ${branch}`);
    await createPullRequest(repoRef, {
        head: branch,
        base: defaultBranch,
        title,
        body,
    });
}

export async function finalizeGitState(workingDirectory?: string | null) {
    if (!workingDirectory) {
        return;
    }

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

        const gitDir = match[1];
        if (!gitDir) {
            return null;
        }
        const normalizedGitDir = gitDir.trim();
        const absoluteGitDir = path.isAbsolute(normalizedGitDir)
            ? normalizedGitDir
            : path.resolve(worktreePath, normalizedGitDir);
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

function getGithubToken() {
    return process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? null;
}

async function getGithubRepoRef(dir: string): Promise<GithubRepoRef | null> {
    const { stdout } = await execAsync("git config --get remote.origin.url", {
        cwd: dir,
        timeout: 5_000,
    });
    const remoteUrl = stdout.trim();
    if (!remoteUrl) {
        return null;
    }

    // Supports both SSH and HTTPS remotes, like git@github.com:owner/repo.git and https://github.com/owner/repo.git.
    const match = remoteUrl.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/i);
    if (!match) {
        return null;
    }
    const owner = match[1];
    const repo = match[2];
    if (!owner || !repo) {
        return null;
    }

    return { owner, repo };
}

async function fetchGithubApi<T>(url: string, init: RequestInit = {}): Promise<T> {
    const token = getGithubToken();
    if (!token) {
        throw new Error("Missing GitHub token. Set GITHUB_TOKEN or GH_TOKEN.");
    }

    const headers = new Headers(init.headers);
    headers.set("Accept", "application/vnd.github+json");
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("X-GitHub-Api-Version", "2022-11-28");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
        const response = await fetch(url, {
            ...init,
            headers,
            signal: controller.signal,
        });
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`GitHub API request failed (${response.status}): ${errorBody}`);
        }
        return (await response.json()) as T;
    } finally {
        clearTimeout(timeout);
    }
}

async function fetchPullRequestsByHead(
    repoRef: GithubRepoRef,
    branch: string,
    state: "open" | "closed" | "all",
) {
    const head = `${repoRef.owner}:${branch}`;
    const params = new URLSearchParams({
        state,
        head,
        per_page: "1",
    });
    const url = `https://api.github.com/repos/${repoRef.owner}/${repoRef.repo}/pulls?${params.toString()}`;
    return fetchGithubApi<Array<GithubPullRequest>>(url);
}

async function createPullRequest(
    repoRef: GithubRepoRef,
    payload: { head: string; base: string; title: string; body: string },
) {
    const url = `https://api.github.com/repos/${repoRef.owner}/${repoRef.repo}/pulls`;
    await fetchGithubApi(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            head: payload.head,
            base: payload.base,
            title: payload.title,
            body: payload.body,
            maintainer_can_modify: true,
        }),
    });
}

async function getPullRequestTitle(dir: string, branch: string) {
    try {
        const { stdout } = await execAsync("git log -1 --pretty=%s", {
            cwd: dir,
            timeout: 5_000,
        });
        const subject = stdout.trim();
        return subject || `Update ${branch}`;
    } catch {
        return `Update ${branch}`;
    }
}

async function getPullRequestBody(dir: string) {
    try {
        const { stdout } = await execAsync("git log -1 --pretty=%b", {
            cwd: dir,
            timeout: 5_000,
            maxBuffer: 1024 * 1024,
        });
        return stdout.trim();
    } catch {
        return "";
    }
}
