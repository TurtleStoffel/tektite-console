# projects domain

## Purpose
Manages projects and enriches project data with clone metadata.

## Exported service functions
### `projectsService.getProjectById(projectId)`
```mermaid
sequenceDiagram
    participant Caller
    participant ProjectsService
    participant Repo
    Caller->>ProjectsService: getProjectById(projectId)
    ProjectsService->>Repo: findProjectById(projectId)
    ProjectsService-->>Caller: project/404
```

## HTTP APIs (routes)

### `GET /api/projects`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant DomainApi
    participant Repo
    Client->>Route: GET /api/projects
    Route->>DomainApi: listProjects()
    DomainApi->>Repo: listProjects()
    DomainApi-->>Route: projects
    Route-->>Client: JSON
```

### `POST /api/projects`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant DomainApi
    participant Repo
    Client->>Route: POST /api/projects
    Route->>DomainApi: createProject(...)
    DomainApi->>Repo: validate + insert
    DomainApi-->>Route: created/error
    Route-->>Client: JSON
```

### `PUT /api/projects/order`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant DomainApi
    participant Repo
    Client->>Route: PUT /api/projects/order
    Route->>DomainApi: reorderProjects(...)
    DomainApi->>Repo: listProjectIds()
    DomainApi->>Repo: reorderProjects(...)
    DomainApi-->>Route: reordered/error
    Route-->>Client: JSON
```

### `GET /api/projects/:id`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant DomainApi
    participant Repo
    participant CloneDiscovery
    Client->>Route: GET /api/projects/:id
    Route->>DomainApi: getProject(id)
    DomainApi->>Repo: find project
    DomainApi->>CloneDiscovery: inspect clones
    DomainApi-->>Route: project details
    Route-->>Client: JSON
```

### `PUT /api/projects/:id`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant DomainApi
    participant Repo
    Client->>Route: PUT /api/projects/:id
    Route->>DomainApi: updateProjectRepository(...)
    DomainApi->>Repo: validate + update
    DomainApi-->>Route: updated/error
    Route-->>Client: JSON
```

### `DELETE /api/projects/:id`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant DomainApi
    participant Repo
    Client->>Route: DELETE /api/projects/:id
    Route->>DomainApi: deleteProject(id)
    DomainApi->>Repo: deleteProject(id)
    DomainApi-->>Route: deleted/404
    Route-->>Client: JSON
```
