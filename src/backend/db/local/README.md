# Local DB Data Model

This document describes the data models defined in `schema.ts` and how they relate.

## Mermaid Diagram

```mermaid
erDiagram
    repositories ||--o{ projects : "repository_id -> id (SET NULL)"
    projects ||--o{ documents : "project_id -> id (SET NULL)"
    projects ||--o{ tasks : "project_id -> id (SET NULL)"

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
        text project_id FK
        text description
        text created_at
        boolean is_done
        text done_at
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
- Foreign keys from `projects`, `documents`, and `tasks` use `ON DELETE SET NULL`.
