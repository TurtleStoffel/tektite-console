# documents domain

## Purpose
Manage markdown documents, optionally linked to a project.

## Dependencies with other domains
- None (project validation is done through this domain's repository layer).

## Exposed service functions

### `documentsService.listDocuments()`
```mermaid
sequenceDiagram
    participant Route
    participant Service as documents service
    participant Repo as documents repository
    Route->>Service: listDocuments()
    Service->>Repo: listDocuments()
    Repo-->>Service: rows
    Service-->>Route: mapped documents
```

### `documentsService.createDocument(input)`
```mermaid
sequenceDiagram
    participant Route
    participant Service as documents service
    participant Repo as documents repository
    Route->>Service: createDocument(markdown, projectId?)
    Service->>Repo: findProject(projectId?)
    Service->>Repo: createDocument(id, markdown, projectId)
    Service-->>Route: created document or error
```

### `documentsService.listProjectDocuments(projectId)`
```mermaid
sequenceDiagram
    participant Route
    participant Service as documents service
    participant Repo as documents repository
    Route->>Service: listProjectDocuments(projectId)
    Service->>Repo: findProject(projectId)
    Service->>Repo: listProjectDocuments(projectId)
    Service-->>Route: documents or 404
```

### `documentsService.createProjectDocument(input)`
```mermaid
sequenceDiagram
    participant Route
    participant Service as documents service
    participant Repo as documents repository
    Route->>Service: createProjectDocument(projectId, markdown)
    Service->>Repo: findProject(projectId)
    Service->>Repo: createDocument(id, markdown, projectId)
    Service-->>Route: created document or 404
```

### `documentsService.getDocument(documentId)`
```mermaid
sequenceDiagram
    participant Route
    participant Service as documents service
    participant Repo as documents repository
    Route->>Service: getDocument(documentId)
    Service->>Repo: findDocument(documentId)
    Service-->>Route: document or 404
```

### `documentsService.updateDocument(input)`
```mermaid
sequenceDiagram
    participant Route
    participant Service as documents service
    participant Repo as documents repository
    Route->>Service: updateDocument(documentId, markdown, projectId?)
    Service->>Repo: findProject(projectId?)
    Service->>Repo: updateDocument(...)
    Service->>Repo: findDocument(documentId)
    Service-->>Route: updated document or error
```

### `documentsService.deleteDocument(documentId)`
```mermaid
sequenceDiagram
    participant Route
    participant Service as documents service
    participant Repo as documents repository
    Route->>Service: deleteDocument(documentId)
    Service->>Repo: deleteDocument(documentId)
    Service-->>Route: deleted id
```
