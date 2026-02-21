# documents domain

## Purpose
Manages markdown documents linked to projects.

## Exported service functions
- None. This domain does not currently expose `service.ts`.

## HTTP APIs (routes)

### `GET /api/documents`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant DomainApi
    participant Repo
    Client->>Route: GET /api/documents
    Route->>DomainApi: listDocuments()
    DomainApi->>Repo: listDocuments()
    DomainApi-->>Route: documents
    Route-->>Client: JSON
```

### `POST /api/documents`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant DomainApi
    participant Repo
    Client->>Route: POST /api/documents
    Route->>DomainApi: createDocument(...)
    DomainApi->>Repo: validate project + insert
    DomainApi-->>Route: created/error
    Route-->>Client: JSON
```

### `GET /api/projects/:id/documents`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant DomainApi
    participant Repo
    Client->>Route: GET /api/projects/:id/documents
    Route->>DomainApi: listProjectDocuments(id)
    DomainApi->>Repo: fetch by project
    DomainApi-->>Route: documents/404
    Route-->>Client: JSON
```

### `POST /api/projects/:id/documents`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant DomainApi
    participant Repo
    Client->>Route: POST /api/projects/:id/documents
    Route->>DomainApi: createProjectDocument(...)
    DomainApi->>Repo: validate project + insert
    DomainApi-->>Route: created/404
    Route-->>Client: JSON
```

### `GET /api/documents/:id`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant DomainApi
    participant Repo
    Client->>Route: GET /api/documents/:id
    Route->>DomainApi: getDocument(id)
    DomainApi->>Repo: findDocument(id)
    DomainApi-->>Route: row/404
    Route-->>Client: JSON
```

### `PUT /api/documents/:id`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant DomainApi
    participant Repo
    Client->>Route: PUT /api/documents/:id
    Route->>DomainApi: updateDocument(...)
    DomainApi->>Repo: validate project + update
    DomainApi-->>Route: updated/error
    Route-->>Client: JSON
```

### `DELETE /api/documents/:id`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant DomainApi
    participant Repo
    Client->>Route: DELETE /api/documents/:id
    Route->>DomainApi: deleteDocument(id)
    DomainApi->>Repo: deleteDocument(id)
    DomainApi-->>Route: deleted id
    Route-->>Client: JSON
```
