# dependencies domain

## Purpose
Generates dependency graph data for a target path.

## Exported service functions
- None. This domain does not currently expose `service.ts`.

## HTTP APIs (routes)

### `GET /api/dependencies/graph`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant DomainApi
    participant FS
    participant Madge
    Client->>Route: GET /api/dependencies/graph?path=...
    Route->>DomainApi: generateGraphData(path)
    DomainApi->>FS: validate path / resolve files
    DomainApi->>Madge: build graph
    DomainApi-->>Route: nodes + edges
    Route-->>Client: JSON
```
