create table if not exists task_history (
    id text primary key,
    project_id text references projects(id) on delete set null,
    repository_url text not null,
    prompt text not null,
    created_at timestamptz not null default timezone('utc', now())
);
