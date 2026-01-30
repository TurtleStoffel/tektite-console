create table if not exists repositories (
    id text primary key,
    name text not null,
    url text not null
);

create table if not exists projects (
    id text primary key,
    name text not null,
    repository_id text references repositories(id) on delete set null
);

create table if not exists documents (
    id text primary key,
    project_id text references projects(id) on delete set null,
    markdown text not null
);