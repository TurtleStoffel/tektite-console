# git domain

## Purpose
Provides git and GitHub API operations for worktree lifecycle and dev terminal flows.

The pull-request cleanup worker also coordinates with the tasks domain: when a worktree is removed, any task linked through `project_tasks.worktree_path` is marked done. Cleanup skips worktrees younger than the configured minimum age to avoid deleting newly created worktrees before agent startup marks them active.

## Exported service functions

### `isWorktreeInUse(workspacePath)`
```mermaid
sequenceDiagram
    participant Caller
    participant GitService
    participant Activity
    Caller->>GitService: isWorktreeInUse(path)
    GitService->>Activity: check in-use map/port file
    GitService-->>Caller: boolean
```

### `markAgentWorkspaceActive(workspacePath)`
```mermaid
sequenceDiagram
    participant Caller
    participant GitService
    participant Activity
    Caller->>GitService: markAgentWorkspaceActive(path)
    GitService->>Activity: mark active
    GitService-->>Caller: void
```

### `markAgentWorkspaceInactive(workspacePath)`
```mermaid
sequenceDiagram
    participant Caller
    participant GitService
    participant Activity
    Caller->>GitService: markAgentWorkspaceInactive(path)
    GitService->>Activity: mark inactive
    GitService-->>Caller: void
```

### `sanitizeRepoName(name)`
```mermaid
sequenceDiagram
    participant Caller
    participant GitService
    Caller->>GitService: sanitizeRepoName(name)
    GitService-->>Caller: sanitizedName
```

### `detectRepoChanges(dir)`
```mermaid
sequenceDiagram
    participant Caller
    participant GitService
    participant GitCLI
    Caller->>GitService: detectRepoChanges(dir)
    GitService->>GitCLI: git status --porcelain
    GitService-->>Caller: hasChanges
```

### `listGithubRepos()`
```mermaid
sequenceDiagram
    participant Caller
    participant GitService
    participant GitHubAPI
    Caller->>GitService: listGithubRepos()
    GitService->>GitHubAPI: GET /user/repos
    GitService-->>Caller: repos
```

### `getPullRequestStatus(dir)`
```mermaid
sequenceDiagram
    participant Caller
    participant GitService
    participant GitCLI
    participant GitHubAPI
    Caller->>GitService: getPullRequestStatus(dir)
    GitService->>GitCLI: resolve branch
    GitService->>GitHubAPI: GET /repos/{owner}/{repo}/pulls?head=owner:branch
    GitService-->>Caller: pr status
```

### `removeWorktree(worktreePath, repoRoot, branchName?)`
```mermaid
sequenceDiagram
    participant Caller
    participant GitService
    participant GitCLI
    Caller->>GitService: removeWorktree(...)
    GitService->>GitCLI: git worktree remove --force
    GitService->>GitCLI: git branch -D (optional)
    GitService-->>Caller: void
```

### `hasUnpushedCommits(dir)`
```mermaid
sequenceDiagram
    participant Caller
    participant GitService
    participant GitCLI
    Caller->>GitService: hasUnpushedCommits(dir)
    GitService->>GitCLI: read branch/upstream status
    GitService-->>Caller: boolean|null
```

### `cleanRepositoryUrl(repoUrl)`
```mermaid
sequenceDiagram
    participant Caller
    participant GitService
    Caller->>GitService: cleanRepositoryUrl(url)
    GitService-->>Caller: cleanedUrl
```

### `prepareWorktree(repoUrl, clonesDir)`
```mermaid
sequenceDiagram
    participant Caller
    participant GitService
    participant FS
    participant GitCLI
    Caller->>GitService: prepareWorktree(url, dir)
    GitService->>FS: ensure clone directory
    GitService->>GitCLI: clone/fetch/worktree add
    GitService-->>Caller: worktree metadata
```

### `finalizeGitState(workingDirectory?)`
```mermaid
sequenceDiagram
    participant Caller
    participant GitService
    participant GitCLI
    participant GitHubAPI
    Caller->>GitService: finalizeGitState(dir)
    GitService->>GitCLI: push branch if ahead
    GitService->>GitHubAPI: POST /repos/{owner}/{repo}/pulls if missing
    GitService-->>Caller: void
```

### `isWorktreeDir(dir)`
```mermaid
sequenceDiagram
    participant Caller
    participant GitService
    participant FS
    Caller->>GitService: isWorktreeDir(dir)
    GitService->>FS: inspect .git pointer file
    GitService-->>Caller: boolean
```

### `extractWorktreeRepoRoot(worktreePath)`
```mermaid
sequenceDiagram
    participant Caller
    participant GitService
    participant FS
    Caller->>GitService: extractWorktreeRepoRoot(path)
    GitService->>FS: read .git pointer
    GitService-->>Caller: repoRoot/worktreeGitDir|null
```

## HTTP APIs (routes)

### `GET /api/github/repos`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant GitService
    participant GitHubAPI
    Client->>Route: GET /api/github/repos
    Route->>GitService: listGithubRepos()
    GitService->>GitHubAPI: GET /user/repos
    GitService-->>Route: repos
    Route-->>Client: JSON
```

### `POST /api/worktrees/dev-terminal/start`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant WorktreesService
    participant Terminal
    Client->>Route: POST /api/worktrees/dev-terminal/start
    Route->>WorktreesService: startDevTerminal(path)
    WorktreesService->>Terminal: create/reuse session
    WorktreesService-->>Route: session payload
    Route-->>Client: JSON
```
