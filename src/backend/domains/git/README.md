# git domain

## Purpose
Provide git and GitHub CLI operations for repository cloning, worktree lifecycle, status inspection, PR finalization, dev-terminal lifecycle, and worktree cleanup.

## Dependencies with other domains
- None.

## Key modules
- `service.ts`: core git operations used across domains.
- `worktreesService.ts`: worktree-specific service entrypoints (dev terminal + cleanup orchestrator).
- `routes.ts`: HTTP route for starting/reusing a dev terminal.
- `terminal.ts`: Bun PTY-backed terminal session manager.
- `cleanup.ts`: periodic PR cleanup job for eligible worktrees.
- `workspaceActivity.ts`: in-memory workspace activity tracking + `TEKTITE_PORT_FILE` checks.
- `repository.ts`: local filesystem/repo helpers for worktree service validation.

## Exposed service functions
From `service.ts`:
- `sanitizeRepoName(name)`
- `detectRepoChanges(dir)`
- `getPullRequestStatus(dir)`
- `isWorktreeInUse(workspacePath)`
- `markAgentWorkspaceActive(workspacePath)`
- `markAgentWorkspaceInactive(workspacePath)`
- `removeWorktree(worktreePath, repoRoot, branchName?)`
- `hasUnpushedCommits(dir)`
- `cleanRepositoryUrl(repoUrl)`
- `prepareWorktree(repoUrl, clonesDir)`
- `finalizeGitState(workingDirectory?)`
- `isWorktreeDir(dir)`
- `extractWorktreeRepoRoot(worktreePath)`

From `worktreesService.ts`:
- `createWorktreesService({ clonesDir }).startDevTerminal(rawPath)`
- `startPullRequestCleanup({ clonesDir, intervalMs? })`
