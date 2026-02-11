# tektite-console

To install dependencies:

```bash
bun install
```

To start a development server:

```bash
bun dev
```

To run for production:

```bash
bun start
```

## Environment

Server startup requires:

- `CLONES_DIR` (path to local clone workspace)
- `SUPABASE_DATABASE_URL` (Postgres connection string for Supabase)

Local SQLite storage defaults to `./.tektite.sqlite` and can be overridden with:

- `SQLITE_PATH` (full sqlite file path), or
- `DATA_DIR` (uses `<DATA_DIR>/tektite.sqlite`)

## GitHub CLI

Some repo/PR features use the GitHub CLI (`gh`). Install it and ensure you’re authenticated:

```bash
gh auth status
```

This project was created using `bun init` in bun v1.3.0. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
