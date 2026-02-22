# agents domain

## Purpose
Owns coding agent integrations.

## Exported service functions
- None. This domain does not currently expose `service.ts`.

## HTTP APIs (routes)

### `POST /api/execute`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant DomainApi
    participant Tasks
    participant Projects
    participant Git
    Client->>Route: POST /api/execute
    Route->>DomainApi: executeByTaskId(taskId)
    DomainApi->>Tasks: getTaskById(taskId)
    DomainApi->>Projects: getProjectById(task.projectId)
    DomainApi->>Git: prepareWorktree(...)
    DomainApi->>Tasks: setTaskWorktreePath(taskId, worktreePath)
    DomainApi-->>Route: stream response
    Route-->>Client: execution stream
```

### `POST /api/resume`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant DomainApi
    Client->>Route: POST /api/resume
    Route->>DomainApi: executeThreadComment(...)
    DomainApi-->>Route: stream response
    Route-->>Client: execution stream
```

### `GET /api/codex-threads`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant DomainApi
    participant FS
    Client->>Route: GET /api/codex-threads
    Route->>DomainApi: listThreads()
    DomainApi->>FS: read ~/.codex/sessions
    DomainApi-->>Route: thread summaries
    Route-->>Client: JSON
```

### `POST /api/codex-threads/analyze`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant DomainApi
    participant CodexSDK
    Client->>Route: POST /api/codex-threads/analyze
    Route->>DomainApi: analyzeThread(...)
    DomainApi->>CodexSDK: run analysis prompt
    DomainApi-->>Route: markdown analysis
    Route-->>Client: JSON
```

### `POST /api/agents/worktree-thread-metadata`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant DomainApi
    participant State
    Client->>Route: POST /api/agents/worktree-thread-metadata
    Route->>DomainApi: getWorktreeThreadMetadata(...)
    DomainApi->>State: read thread map
    DomainApi-->>Route: metadata map
    Route-->>Client: JSON
```
