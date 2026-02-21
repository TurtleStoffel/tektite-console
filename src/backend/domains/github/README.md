# github domain

## Purpose
Reads repository metadata from the GitHub CLI.

## Exported service functions

### `createGithubService().listRepos()`
```mermaid
sequenceDiagram
    participant Caller
    participant GithubService
    participant GhCLI
    Caller->>GithubService: listRepos()
    GithubService->>GhCLI: gh repo list --json ...
    GithubService-->>Caller: repo list
```

## HTTP APIs (routes)

### `GET /api/github/repos`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant GithubService
    participant GhCLI
    Client->>Route: GET /api/github/repos
    Route->>GithubService: listRepos()
    GithubService->>GhCLI: read repos
    GithubService-->>Route: repos
    Route-->>Client: JSON
```
