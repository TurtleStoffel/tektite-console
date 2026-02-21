# tasks domain

## Purpose
Stores and updates task execution history.

## Exported service functions

### `tasksService.listTaskHistory()`
```mermaid
sequenceDiagram
    participant Caller
    participant TasksService
    participant Repo
    Caller->>TasksService: listTaskHistory()
    TasksService->>Repo: listTaskHistory()
    TasksService-->>Caller: tasks
```

### `tasksService.listProjectTaskHistory(projectId, filter?)`
```mermaid
sequenceDiagram
    participant Caller
    participant TasksService
    participant Repo
    Caller->>TasksService: listProjectTaskHistory(...)
    TasksService->>Repo: findProject(projectId)
    TasksService->>Repo: listProjectTaskHistory(...)
    TasksService-->>Caller: tasks/404
```

### `tasksService.createTaskHistory(input)`
```mermaid
sequenceDiagram
    participant Caller
    participant TasksService
    participant Repo
    Caller->>TasksService: createTaskHistory(...)
    TasksService->>Repo: validate project (optional)
    TasksService->>Repo: createTaskHistory(...)
    TasksService-->>Caller: created task/404
```

### `tasksService.markTaskHistoryDone(taskId)`
```mermaid
sequenceDiagram
    participant Caller
    participant TasksService
    participant Repo
    Caller->>TasksService: markTaskHistoryDone(taskId)
    TasksService->>Repo: findTaskHistoryById(taskId)
    TasksService->>Repo: markTaskHistoryDone(...)
    TasksService-->>Caller: updated task/404
```

## HTTP APIs (routes)

### `GET /api/tasks`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant TasksService
    Client->>Route: GET /api/tasks
    Route->>TasksService: listTaskHistory()
    TasksService-->>Route: tasks
    Route-->>Client: JSON
```

### `POST /api/tasks`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant TasksService
    Client->>Route: POST /api/tasks
    Route->>TasksService: createTaskHistory(...)
    TasksService-->>Route: created/error
    Route-->>Client: JSON
```

### `GET /api/projects/:id/tasks`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant TasksService
    Client->>Route: GET /api/projects/:id/tasks
    Route->>TasksService: listProjectTaskHistory(...)
    TasksService-->>Route: tasks/404
    Route-->>Client: JSON
```

### `POST /api/tasks/:id/done`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant TasksService
    Client->>Route: POST /api/tasks/:id/done
    Route->>TasksService: markTaskHistoryDone(id)
    TasksService-->>Route: updated/404
    Route-->>Client: JSON
```
