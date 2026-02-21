# notes domain

## Purpose
Read notes data from Supabase `public.notes` for the Notes page.

## Dependencies with other domains
- None.

## Exposed service functions

### `notesService.listNotes()`
```mermaid
sequenceDiagram
    participant Route
    participant Service as notes service
    participant Repo as notes repository
    Route->>Service: listNotes()
    Service->>Repo: listNotes()
    Repo-->>Service: rows from public.notes
    Service-->>Route: mapped notes
```
