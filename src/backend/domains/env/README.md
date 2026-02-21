# env domain

## Purpose
Exposes server environment summary values for clients.

## Exported service functions
- None. This domain does not currently expose `service.ts`.

## HTTP APIs (routes)

### `GET /api/env`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant DomainApi
    participant Repo
    Client->>Route: GET /api/env
    Route->>DomainApi: getEnv()
    DomainApi->>Repo: readNodeEnv()
    DomainApi-->>Route: env summary
    Route-->>Client: JSON
```
