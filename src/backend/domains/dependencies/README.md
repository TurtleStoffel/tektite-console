# dependencies domain

## Purpose
Generate an import graph for a target path using Madge, with git-aware input filtering when possible.

## Dependencies with other domains
- None.

## Exposed service functions

### `createDependencyService().generateGraphData(rawTargetPath)`
```mermaid
sequenceDiagram
    participant Route
    participant Service as dependencies service
    participant FS as File system
    participant Git as git CLI
    participant Madge
    Route->>Service: generateGraphData(path)
    Service->>FS: validate target path
    Service->>Git: resolve repo root + tracked/unignored files
    Service->>Madge: build dependency graph
    Madge-->>Service: dependency object
    Service-->>Route: Result.ok({ nodes, edges })
```
