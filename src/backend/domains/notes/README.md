# notes domain

## Purpose
Reads notes data for the Notes page.

## Exported service functions
- None. This domain does not currently expose `service.ts`.

## HTTP APIs (routes)

### `GET /api/notes`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant DomainApi
    participant Repo
    Client->>Route: GET /api/notes
    Route->>DomainApi: listNotes()
    DomainApi->>Repo: listNotes()
    DomainApi-->>Route: notes
    Route-->>Client: JSON
```
