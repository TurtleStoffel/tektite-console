# git domain

## Purpose
Provide git and GitHub CLI operations for repository cloning, worktree lifecycle, status inspection, and PR finalization.

## Dependencies with other domains
- None.

## Exposed service functions
- `sanitizeRepoName(name)`
- `detectRepoChanges(dir)`
- `getPullRequestStatus(dir)`
- `removeWorktree(worktreePath, repoRoot, branchName?)`
- `hasUnpushedCommits(dir)`
- `cleanRepositoryUrl(repoUrl)`
- `prepareWorktree(repoUrl, clonesDir)`
- `finalizeGitState(workingDirectory?)`
- `isWorktreeDir(dir)`
- `extractWorktreeRepoRoot(worktreePath)`
