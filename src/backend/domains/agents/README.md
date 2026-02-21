# agents domain

## Purpose
Owns coding agent integrations:
- Analyze local Codex thread logs from `~/.codex/sessions`.
- Stream execution runs through Codex or OpenCode.

## Dependencies with other domains
- `git/service` (activity tracking).

## Exposed service functions

### `createAgentsService().listThreads()`
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

### `createAgentsService().analyzeThread(input)`
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
