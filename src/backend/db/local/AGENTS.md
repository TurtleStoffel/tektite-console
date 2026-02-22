# Local DB Folder Guidelines

## Migration Workflow
- Local SQLite schema changes are managed by Drizzle migrations, not ad-hoc startup `CREATE TABLE` statements.
- After changing `src/backend/db/local/schema.ts`, generate a migration with `bun run db:generate:local -- --name=<descriptive_name>`.
- Keep migration names descriptive (for example `rename_task_history_to_tasks`) instead of random generated names.
- Runtime database initialization applies migrations from `src/backend/db/local/migrations`.

## README Sync Requirement
- If `src/backend/db/local/schema.ts` changes in a way that adds, removes, renames, or rewires any data model or relationship, update `src/backend/db/local/README.md` in the same change.
- Keep the Mermaid diagram accurate to the current schema, including table names, keys, and foreign-key connections.
- Keep the relationship notes in sync with diagram and schema behavior (for example, `ON DELETE` behavior).
