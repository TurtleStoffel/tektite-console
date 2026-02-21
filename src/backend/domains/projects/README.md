# projects domain

## Purpose
Manage projects and enrich project details with clone/worktree runtime metadata.

## Exposed service functions

### `createProjectsService({ clonesDir }).listProjects()`
```mermaid
sequenceDiagram
    participant Route
    participant Service as projects service
    participant Repo as projects repository
    Route->>Service: listProjects()
    Service->>Repo: listProjects()
    Repo-->>Service: rows
    Service-->>Route: mapped projects
```

### `createProjectsService({ clonesDir }).createProject(input)`
```mermaid
sequenceDiagram
    participant Route
    participant Service as projects service
    participant Repo as projects repository
    Route->>Service: createProject(name, repositoryId)
    Service->>Repo: findRepositoryById(repositoryId)
    Service->>Repo: hasProjectForRepository(repositoryId)
    Service->>Repo: createProject(...)
    Service-->>Route: created project or error
```

### `createProjectsService({ clonesDir }).getProject(projectId)`
```mermaid
sequenceDiagram
    participant Route
    participant Service as projects service
    participant Repo as projects repository
    participant Clone as clone discovery
    Route->>Service: getProject(projectId)
    Service->>Repo: findProjectById(projectId)
    Service->>Clone: findRepositoryClones(repositoryUrl)
    Service->>Repo: listWorktreePromptSummariesByPaths(paths)
    Service-->>Route: project + clones
```

### `createProjectsService({ clonesDir }).updateProjectRepository(input)`
```mermaid
sequenceDiagram
    participant Route
    participant Service as projects service
    participant Repo as projects repository
    Route->>Service: updateProjectRepository(projectId, repositoryId)
    Service->>Repo: findRepositoryById(repositoryId)
    Service->>Repo: hasOtherProjectForRepository(...)
    Service->>Repo: updateProjectRepository(...)
    Service->>Repo: findProjectById(projectId)
    Service-->>Route: updated project or error
```

### `createProjectsService({ clonesDir }).deleteProject(projectId)`
```mermaid
sequenceDiagram
    participant Route
    participant Service as projects service
    participant Repo as projects repository
    Route->>Service: deleteProject(projectId)
    Service->>Repo: deleteProject(projectId)
    Service-->>Route: deleted id or 404
```
