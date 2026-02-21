# worktrees domain

## Purpose
Start/reuse dev terminals for allowed worktree paths and run periodic PR cleanup.

## Dependencies with other domains
- None.

## Exposed service functions

### `createWorktreesService({ clonesDir }).startDevTerminal(rawPath)`
```mermaid
sequenceDiagram
    participant Route
    participant Service as worktrees service
    participant Repo as worktrees repository
    participant Terminal as terminal manager
    Route->>Service: startDevTerminal(rawPath)
    Service->>Repo: validate root + exists + git repo
    Service->>Terminal: startOrReuseTerminal(worktreePath)
    Service-->>Route: terminal session or error
```

### `startPullRequestCleanup({ clonesDir, intervalMs? })`
```mermaid
sequenceDiagram
    participant Boot as Server boot
    participant Service as worktrees service
    participant Cleanup as cleanup job
    Boot->>Service: startPullRequestCleanup(...)
    Service->>Cleanup: startPullRequestCleanupJob(...)
    Cleanup-->>Boot: stop handle
```
