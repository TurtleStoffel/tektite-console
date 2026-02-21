# execute domain

## Purpose
Run prompt-driven coding executions in a prepared worktree and stream results.

## Dependencies with other domains
- `tasks` domain via `tasksService.createTaskHistory` (only for `executeWithTaskHistory`).

## Exposed service functions

### `createExecuteService({ clonesDir }).executeWithTaskHistory(input)`
```mermaid
sequenceDiagram
    participant Route
    participant Service as execute service
    participant Tasks as tasks service
    participant Git as git helpers
    participant Repo as execute repository
    participant Runner as codex/opencode stream
    Route->>Service: executeWithTaskHistory(prompt, projectId, repositoryUrl)
    Service->>Tasks: createTaskHistory(...)
    Service->>Git: ensureClonesDir + prepareWorktree
    Service->>Repo: upsertWorktreePromptSummary(...)
    Service->>Runner: streamRun(prompt, workingDirectory)
    Service-->>Route: Result.ok(stream)
```

### `createExecuteService({ clonesDir }).execute(input)`
```mermaid
sequenceDiagram
    participant Route
    participant Service as execute service
    participant Git as git helpers
    participant Repo as execute repository
    participant Runner as codex/opencode stream
    Route->>Service: execute(prompt, repositoryUrl)
    Service->>Git: ensureClonesDir + prepareWorktree
    Service->>Repo: upsertWorktreePromptSummary(...)
    Service->>Runner: streamRun(prompt, workingDirectory)
    Service-->>Route: Result.ok(stream)
```

### `createExecuteService({ clonesDir }).executeThreadComment(input)`
```mermaid
sequenceDiagram
    participant Route
    participant Service as execute service
    participant Runner as codex/opencode stream
    Route->>Service: executeThreadComment(comment, workingDirectory, threadId)
    Service->>Runner: streamRun(comment, workingDirectory, threadId)
    Service-->>Route: Result.ok(stream)
```
