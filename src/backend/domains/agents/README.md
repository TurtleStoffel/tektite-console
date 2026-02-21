# agents domain

## Purpose
Owns coding agent integrations:
- Analyze local Codex thread logs from `~/.codex/sessions`.
- Stream execution runs through Codex or OpenCode.
- Execute prompt-driven tasks in prepared worktrees and stream results.

## Dependencies with other domains
- `git/service` (worktree preparation).
- `tasks/service` (task-history creation for `/api/execute`).

## Exposed service functions

### `createAgentsService({ clonesDir }).executeWithTaskHistory(input)`
```mermaid
sequenceDiagram
    participant Route
    participant Service as agents service
    participant Tasks as tasks service
    participant Git as git helpers
    participant Repo as agents repository
    participant Runner as codex/opencode stream
    Route->>Service: executeWithTaskHistory(prompt, projectId, repositoryUrl)
    Service->>Tasks: createTaskHistory(...)
    Service->>Git: prepareWorktree
    Service->>Repo: upsertWorktreePromptSummary(...)
    Service->>Runner: streamRun(prompt, workingDirectory)
    Service-->>Route: Result.ok(stream)
```

### `createAgentsService({ clonesDir }).execute(input)`
```mermaid
sequenceDiagram
    participant Route
    participant Service as agents service
    participant Git as git helpers
    participant Repo as agents repository
    participant Runner as codex/opencode stream
    Route->>Service: execute(prompt, repositoryUrl)
    Service->>Git: prepareWorktree
    Service->>Repo: upsertWorktreePromptSummary(...)
    Service->>Runner: streamRun(prompt, workingDirectory)
    Service-->>Route: Result.ok(stream)
```

### `createAgentsService({ clonesDir }).executeThreadComment(input)`
```mermaid
sequenceDiagram
    participant Route
    participant Service as agents service
    participant Runner as codex/opencode stream
    Route->>Service: executeThreadComment(comment, workingDirectory, threadId)
    Service->>Runner: streamRun(comment, workingDirectory, threadId)
    Service-->>Route: Result.ok(stream)
```

### `createAgentsService({ clonesDir }).listThreads()`
```mermaid
sequenceDiagram
    participant Route
    participant Service as agents service
    participant FS as File system (~/.codex/sessions)
    Route->>Service: listThreads()
    Service->>FS: walk directories + stat *.jsonl
    FS-->>Service: thread file metadata
    Service-->>Route: Result.ok(thread summaries)
```

### `createAgentsService({ clonesDir }).analyzeThread(input)`
```mermaid
sequenceDiagram
    participant Route
    participant Service as agents service
    participant FS as File system (~/.codex)
    participant Codex as Codex SDK
    Route->>Service: analyzeThread(threadPath)
    Service->>FS: validate path + stat + read file
    FS-->>Service: thread content
    Service->>Codex: run analysis prompt
    Codex-->>Service: streamed events
    Service-->>Route: Result.ok({ markdown })
```

### `streamAgentRun(input)`
Chooses the runtime provider based on `NODE_ENV`:
- `development`: OpenCode (`opencode.ts`)
- otherwise: Codex (`codex.ts`)
