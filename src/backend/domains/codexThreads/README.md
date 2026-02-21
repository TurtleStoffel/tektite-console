# codexThreads domain

## Purpose
Analyze local Codex thread logs from `~/.codex/sessions`.

## Dependencies with other domains
- None.

## Exposed service functions

### `createCodexThreadsService().listThreads()`
```mermaid
sequenceDiagram
    participant Route
    participant Service as codexThreads service
    participant FS as File system (~/.codex/sessions)
    Route->>Service: listThreads()
    Service->>FS: walk directories + stat *.jsonl
    FS-->>Service: thread file metadata
    Service-->>Route: Result.ok(thread summaries)
```

### `createCodexThreadsService().analyzeThread(input)`
```mermaid
sequenceDiagram
    participant Route
    participant Service as codexThreads service
    participant FS as File system (~/.codex)
    participant Codex as Codex SDK
    Route->>Service: analyzeThread(threadPath)
    Service->>FS: validate path + stat + read file
    FS-->>Service: thread content
    Service->>Codex: run analysis prompt
    Codex-->>Service: streamed events
    Service-->>Route: Result.ok({ markdown })
```
