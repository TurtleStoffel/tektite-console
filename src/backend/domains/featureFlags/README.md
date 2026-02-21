# featureFlags domain

## Purpose
List and upsert runtime feature flags.

## Dependencies with other domains
- None.

## Exposed service functions

### `featureFlagsService.listFeatureFlags()`
```mermaid
sequenceDiagram
    participant Route
    participant Service as featureFlags service
    participant Repo as featureFlags repository
    Route->>Service: listFeatureFlags()
    Service->>Repo: listFeatureFlags()
    Repo-->>Service: rows
    Service-->>Route: mapped flags
```

### `featureFlagsService.upsertFeatureFlag(input)`
```mermaid
sequenceDiagram
    participant Route
    participant Service as featureFlags service
    participant Repo as featureFlags repository
    Route->>Service: upsertFeatureFlag(key, description, isEnabled)
    Service->>Repo: findFeatureFlagByKey(key)
    Service->>Repo: upsertFeatureFlag(...timestamps)
    Service-->>Route: upserted flag
```
