# Backend Guidelines

## Structure
- `src/backend/routes/*`: HTTP API route handlers.
- `src/backend/db/*`: database schema and storage adapters.
- `src/backend/storage.ts`: storage initialization and wiring.
- `src/backend/*`: backend services and infrastructure modules.
- Cross-runtime modules live in `src/shared/*` (not under `src/backend/*`).

## Architecture
- Follow 3 layers:
  - Routes define APIs and request/response contracts.
  - Services implement business logic and orchestration.
  - Repositories handle database and persistence concerns.

## Coding Rules
- Prefer explicit failures over silent fallbacks.
- Catch exceptions only when recovery is meaningful.
- Add runtime logs that make backend flow and failures easy to trace.
