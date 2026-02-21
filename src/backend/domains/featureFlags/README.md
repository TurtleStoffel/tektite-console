# featureFlags domain

## Purpose
Lists and updates runtime feature flags.

## Exported service functions
- None. This domain does not currently expose `service.ts`.

## HTTP APIs (routes)

### `GET /api/feature-flags`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant DomainApi
    participant Repo
    Client->>Route: GET /api/feature-flags
    Route->>DomainApi: listFeatureFlags()
    DomainApi->>Repo: listFeatureFlags()
    DomainApi-->>Route: flags
    Route-->>Client: JSON
```

### `POST /api/feature-flags`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant DomainApi
    participant Repo
    Client->>Route: POST /api/feature-flags
    Route->>DomainApi: upsertFeatureFlag(...)
    DomainApi->>Repo: upsert
    DomainApi-->>Route: flag
    Route-->>Client: JSON
```

### `PUT /api/feature-flags/:key`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant DomainApi
    participant Repo
    Client->>Route: PUT /api/feature-flags/:key
    Route->>DomainApi: upsertFeatureFlag(...)
    DomainApi->>Repo: upsert by key
    DomainApi-->>Route: flag
    Route-->>Client: JSON
```

### `POST /api/feature-flags/:key/toggle`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant DomainApi
    participant Repo
    Client->>Route: POST /api/feature-flags/:key/toggle
    Route->>DomainApi: listFeatureFlags()+upsertFeatureFlag(...)
    DomainApi->>Repo: read then update
    DomainApi-->>Route: toggled flag
    Route-->>Client: JSON
```
