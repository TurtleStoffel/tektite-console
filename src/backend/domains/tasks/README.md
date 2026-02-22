# tasks domain

## Purpose
Stores and updates tasks that are pending or completed.

## Exported service functions

### `tasksService.listTasks(filter?)`
```mermaid
sequenceDiagram
    participant Caller
    participant TasksService
    participant Repo
    Caller->>TasksService: listTasks(filter?)
    TasksService->>Repo: listTasks/listTasksWithFilter
    TasksService-->>Caller: tasks
```

### `tasksService.listProjectTasks(projectId, filter?)`
```mermaid
sequenceDiagram
    participant Caller
    participant TasksService
    participant Repo
    Caller->>TasksService: listProjectTasks(...)
    TasksService->>Repo: findProject(projectId)
    TasksService->>Repo: listProjectTasks(...)
    TasksService-->>Caller: tasks/404
```

### `tasksService.createTask(input)`
```mermaid
sequenceDiagram
    participant Caller
    participant TasksService
    participant Repo
    Caller->>TasksService: createTask(...)
    TasksService->>Repo: validate project (optional)
    TasksService->>Repo: createTask(...)
    TasksService-->>Caller: created task/404
```

### `tasksService.getTaskById(taskId)`
```mermaid
sequenceDiagram
    participant Caller
    participant TasksService
    participant Repo
    Caller->>TasksService: getTaskById(taskId)
    TasksService->>Repo: findTaskById(taskId)
    TasksService-->>Caller: task/404
```

### `tasksService.markTaskDone(taskId)`
```mermaid
sequenceDiagram
    participant Caller
    participant TasksService
    participant Repo
    Caller->>TasksService: markTaskDone(taskId)
    TasksService->>Repo: findTaskById(taskId)
    TasksService->>Repo: markTaskDone(...)
    TasksService-->>Caller: updated task/404
```

### `tasksService.deleteTask(taskId)`
```mermaid
sequenceDiagram
    participant Caller
    participant TasksService
    participant Repo
    Caller->>TasksService: deleteTask(taskId)
    TasksService->>Repo: findTaskById(taskId)
    TasksService->>Repo: deleteTask(taskId)
    TasksService-->>Caller: deleted task/404
```

## HTTP APIs (routes)

### `GET /api/tasks`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant TasksService
    Client->>Route: GET /api/tasks?isDone=&project=
    Route->>TasksService: listTasks(filter?)
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
    Route->>TasksService: createTask(...)
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
    Route->>TasksService: listProjectTasks(...)
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
    Route->>TasksService: markTaskDone(id)
    TasksService-->>Route: updated/404
    Route-->>Client: JSON
```

### `DELETE /api/tasks/:id`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant TasksService
    Client->>Route: DELETE /api/tasks/:id
    Route->>TasksService: deleteTask(id)
    TasksService-->>Route: deleted/404
    Route-->>Client: JSON
```
