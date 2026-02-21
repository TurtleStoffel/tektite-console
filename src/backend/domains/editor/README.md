# editor domain

## Purpose
Opens an allowed local folder in VSCode.

## Exported service functions
- None. This domain does not currently expose `service.ts`.

## HTTP APIs (routes)

### `POST /api/editor/open-vscode`
```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant DomainApi
    participant Repo
    participant CodeCLI
    Client->>Route: POST /api/editor/open-vscode
    Route->>DomainApi: openVscode(path)
    DomainApi->>Repo: resolveAllowedFolder(...)
    DomainApi->>CodeCLI: open folder
    DomainApi-->>Route: ok/error
    Route-->>Client: JSON
```
