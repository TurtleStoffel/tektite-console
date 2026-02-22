# Local DB Data Model

This document describes the data models defined in `schema.ts` and how they relate.

## Mermaid Diagram

```mermaid
erDiagram
    repositories ||--o{ projects : "repository_id -> id (SET NULL)"
    projects ||--o{ documents : "project_id -> id (SET NULL)"
    projects ||--o{ project_tasks : "project_id -> id (CASCADE)"
    tasks ||--o{ project_tasks : "task_id -> id (CASCADE)"
    tasks ||--o| task_canvas_positions : "task_id -> id (CASCADE)"

    repositories {
        text id PK
        text name
        text url
    }

    projects {
        text id PK
        text name
        text repository_id FK
    }

    documents {
        text id PK
        text project_id FK
        text markdown
    }

    tasks {
        text id PK
        text description
        text created_at
        boolean is_done
        text done_at
    }

    task_canvas_positions {
        text task_id PK, FK
        integer x
        integer y
        text updated_at
    }

    project_tasks {
        text project_id PK, FK
        text task_id PK, FK
        text worktree_path
    }

    worktree_prompt_summaries {
        text worktree_path PK
        text prompt_summary
        text created_at
        text updated_at
    }

    feature_flags {
        text key PK
        text description
        boolean is_enabled
        text created_at
        text updated_at
    }
```

## Notes

- `worktree_prompt_summaries` and `feature_flags` are standalone tables with no foreign-key connections in the current schema.
- Foreign keys from `projects` and `documents` use `ON DELETE SET NULL`.
- `project_tasks` is the join table between `projects` and `tasks`, and both foreign keys use `ON DELETE CASCADE`.
- `project_tasks.task_id` is unique, so a task can be assigned to at most one project.
- `project_tasks.worktree_path` stores the task execution worktree path when an assigned task is executed.
- `task_canvas_positions` stores persisted x/y coordinates for each task's infinite canvas card.
- `task_canvas_positions.task_id` is both PK and FK, so each task has at most one persisted position row.
