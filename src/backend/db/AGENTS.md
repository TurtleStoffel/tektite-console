# DB Guidelines

## Default Database Target
- All new database schema and persistence changes must use the local database under `src/backend/db/local/*` by default.
- Do not add or modify Supabase/Postgres schema, migrations, or persistence paths for new changes unless the task explicitly says to use Supabase.

## Exceptions
- Only use `src/backend/db/supabase/*` or `supabase/migrations/*` when the user explicitly requests Supabase/remote DB work.
- If a change might affect both local and Supabase paths, stop and confirm explicit Supabase scope first.
