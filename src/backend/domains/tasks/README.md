# tasks domain

## Purpose
Store and update task execution history, optionally linked to projects.

## Dependencies with other domains
- None (project existence checks happen in this domain repository).

## Exposed service functions

### `tasksService.listTaskHistory()`
```mermaid
sequenceDiagram
    participant Route
    participant Service as tasks service
    participant Repo as tasks repository
    Route->>Service: listTaskHistory()
    Service->>Repo: listTaskHistory()
    Repo-->>Service: rows
    Service-->>Route: mapped tasks
```

### `tasksService.listProjectTaskHistory(projectId, filter?)`
```mermaid
sequenceDiagram
    participant Route
    participant Service as tasks service
    participant Repo as tasks repository
    Route->>Service: listProjectTaskHistory(projectId, filter)
    Service->>Repo: findProject(projectId)
    Service->>Repo: listProjectTaskHistory(projectId, filter)
    Service-->>Route: tasks or 404
```

### `tasksService.createTaskHistory(input)`
```mermaid
sequenceDiagram
    participant Route
    participant Service as tasks service
    participant Repo as tasks repository
    Route->>Service: createTaskHistory(projectId?, prompt)
    Service->>Repo: findProject(projectId?)
    Service->>Repo: createTaskHistory(...)
    Service-->>Route: created task or 404
```

### `tasksService.markTaskHistoryDone(taskId)`
```mermaid
sequenceDiagram
    participant Route
    participant Service as tasks service
    participant Repo as tasks repository
    Route->>Service: markTaskHistoryDone(taskId)
    Service->>Repo: findTaskHistoryById(taskId)
    Service->>Repo: markTaskHistoryDone(taskId, doneAt)
    Service-->>Route: updated task or 404
```
