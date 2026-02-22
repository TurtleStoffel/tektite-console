# Local DB Folder Guidelines

## README Sync Requirement
- If `src/backend/db/local/schema.ts` changes in a way that adds, removes, renames, or rewires any data model or relationship, update `src/backend/db/local/README.md` in the same change.
- Keep the Mermaid diagram accurate to the current schema, including table names, keys, and foreign-key connections.
- Keep the relationship notes in sync with diagram and schema behavior (for example, `ON DELETE` behavior).
