# Tektite Console

Tektite Console is a tool for Coding Agent development workflows.

It provides:
- task management for agent-driven work
- automatic worktree setup and lifecycle support
- visibility into repository structure and project entities
- live preview/dev server support for worktree changes
- integrated tooling for repositories, documents, dependencies, and feature flags
- Supabase-backed notes browsing in the Notes page (`public.notes`)

## Tech stack

- Runtime/server: Bun
- Frontend: React + React Router
- State: React Query
- Validation: Zod
- Styling: Tailwind + DaisyUI
- Data: local SQLite + Supabase Postgres

## Prerequisites

- Bun installed
- GitHub CLI (`gh`) installed and authenticated for GitHub-related features

```bash
gh auth status
```

## Environment variables

Required:
- `CLONES_DIR`: path to local clone/worktree directory
- `SUPABASE_DATABASE_URL`: Supabase/Postgres connection string

Optional (SQLite location):
- `SQLITE_PATH`: explicit sqlite file path
- `DATA_DIR`: if set, sqlite path becomes `<DATA_DIR>/tektite.sqlite`

If neither `SQLITE_PATH` nor `DATA_DIR` is set, local SQLite defaults to `./.tektite.sqlite`.

## Local DB migrations (Drizzle Kit)

Local SQLite migrations are managed with `drizzle-kit`.

Generate a migration after changing `src/backend/db/local/schema.ts`:

```bash
bun run db:generate:local -- --name=<descriptive_name>
```

Apply pending local migrations to the configured SQLite database:

```bash
bun run db:migrate:local
```

Migration files are written to `src/backend/db/local/migrations`.

## Run

1. Install dependencies:

```bash
bun install
```

2. Start the development server (hot reload):

```bash
bun dev
```

3. Open the app in your browser (default):

```text
http://localhost:3000
```

If port `3000` is occupied, the server picks the next available port.

4. Run in production mode:

```bash
bun start
```
