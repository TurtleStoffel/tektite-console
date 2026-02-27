# agents domain

## Purpose
Owns coding agent integrations.

## Detached Run Architecture
```mermaid
flowchart LR
    C[Client UI] -->|POST /api/execute or /api/resume| R[agents/routes.ts]
    R --> D[agents/domainApi.ts]
    D --> Q[runManager.enqueue]
    Q --> S[Background stream consumer]
    S --> A[streamCodexRun / streamOpenCodeRun]
    A --> X[Codex/OpenCode SDK stream events]
    S --> E[executionState updates\nthreadId, lastEvent, lastMessage]
    S --> G[git finalize]
    C -->|poll /api/agents/worktree-thread-metadata| R
    C -->|poll /api/agent-runs| R
```

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
    DomainApi->>DomainApi: enqueue detached run
    DomainApi-->>Route: { runId }
    Route-->>Client: 202 Accepted JSON
```

### `POST /api/resume`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant DomainApi
    Client->>Route: POST /api/resume
    Route->>DomainApi: executeThreadComment(...)
    DomainApi->>DomainApi: enqueue detached run
    DomainApi-->>Route: { runId }
    Route-->>Client: 202 Accepted JSON
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

### `GET /api/agent-runs`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant DomainApi
    participant RunManager
    Client->>Route: GET /api/agent-runs?projectId=...
    Route->>DomainApi: listAgentRuns(...)
    DomainApi->>RunManager: list(...)
    RunManager-->>DomainApi: run summaries
    DomainApi-->>Route: run summaries
    Route-->>Client: JSON
```
