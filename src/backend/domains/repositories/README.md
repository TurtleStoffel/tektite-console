# repositories domain

## Purpose
List locally stored repositories and sync new ones from GitHub.

## Dependencies with other domains
- `github` domain via `createGithubService().listRepos`.

## Exposed service functions

### `repositoriesService.listRepositories()`
```mermaid
sequenceDiagram
    participant Route
    participant Service as repositories service
    participant Repo as repositories repository
    Route->>Service: listRepositories()
    Service->>Repo: listRepositories()
    Repo-->>Service: rows
    Service-->>Route: mapped repositories
```

### `repositoriesService.syncRepositories()`
```mermaid
sequenceDiagram
    participant Route
    participant Service as repositories service
    participant Github as github service
    participant Repo as repositories repository
    Route->>Service: syncRepositories()
    Service->>Github: listRepos()
    Service->>Repo: listExistingRepositoryUrls()
    loop for each GitHub repo
        Service->>Repo: insertRepository(name, url)
    end
    Service-->>Route: { insertedCount, total }
```
