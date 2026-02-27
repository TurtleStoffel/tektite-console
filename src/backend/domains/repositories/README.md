# repositories domain

## Purpose
Lists local repositories and syncs repositories from GitHub.

## Exported service functions
- None. This domain does not currently expose `service.ts`.

## HTTP APIs (routes)

### `GET /api/repositories`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant DomainApi
    participant Repo
    Client->>Route: GET /api/repositories
    Route->>DomainApi: listRepositories()
    DomainApi->>Repo: listRepositories()
    DomainApi-->>Route: repositories
    Route-->>Client: JSON
```

### `POST /api/repositories/sync`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant DomainApi
    participant GitService
    participant Repo
    Client->>Route: POST /api/repositories/sync
    Route->>DomainApi: syncRepositories()
    DomainApi->>GitService: listGithubRepos()
    DomainApi->>Repo: insert missing repos
    DomainApi-->>Route: sync summary
    Route-->>Client: JSON
```
