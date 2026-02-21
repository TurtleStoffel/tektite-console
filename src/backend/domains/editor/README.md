# editor domain

## Purpose
Open an allowed local folder in VSCode.

## Dependencies with other domains
- None.

## Exposed service functions

### `createEditorService({ clonesDir }).openVscode(rawPath)`
```mermaid
sequenceDiagram
    participant Route
    participant Service as editor service
    participant Repo as editor repository
    participant VSCode as code CLI
    Route->>Service: openVscode(rawPath)
    Service->>Repo: resolveAllowedFolder(...)
    Service->>VSCode: openInCode(folderPath)
    Service-->>Route: { ok: true } or error status
```
