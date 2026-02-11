# Backend Guidelines

## Structure
- `src/backend/domains/*`: domain modules (route handlers and domain logic).
- `src/backend/db/*`: database schema and storage adapters.
- `src/backend/storage.ts`: storage initialization and wiring.
- `src/backend/*`: backend services and infrastructure modules.
- Cross-runtime modules live in `src/shared/*` (not under `src/backend/*`).

## Architecture
- Follow 3 layers:
  - Routes define APIs and request/response contracts.
  - Services implement business logic and orchestration.
  - Repositories handle database and persistence concerns.

## Domain Import Boundaries
- For files under `src/backend/domains/*`, cross-domain imports must target only `service.ts`.
- Use alias imports (`@/backend/domains/...`) only for cross-domain service access.
- Use relative imports for same-domain internals (for example `./repository`, `./useCase`).
- Do not import another domain's internals directly (for example `@/backend/domains/projects/useCase`).

## Coding Rules
- Prefer explicit failures over silent fallbacks.
- Catch exceptions only when recovery is meaningful.
- Add runtime logs that make backend flow and failures easy to trace.
