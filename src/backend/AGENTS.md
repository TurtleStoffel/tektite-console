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
  - Repositories handle database persistence only.
- Use functional core / imperative shell:
  - Imperative shell: route handlers and top-level service functions handle IO, logging, and orchestration.
  - Functional core: pure business logic functions transform validated inputs into domain decisions.
  - Keep pure logic free of direct DB/network/time access and side effects.

## Result Types
- Use `typescript-result` for expected business failures instead of throwing exceptions.
- Return `Result<OkType, ErrType>` from service and domain logic paths where failures are part of normal control flow.
- Model domain errors as explicit typed variants (for example discriminated unions), and map them to HTTP responses at the route layer.
- Throw only for truly exceptional/unrecoverable conditions; avoid mixing thrown errors and `Result` for the same failure mode.
- Do not add new service/domain APIs that return `{ error, status }` objects for expected failures; keep those mappings in route handlers.
- Prefer `Result` chaining (`map`, `mapError`, `recover`, `Result.fromAsync`, `Result.gen`) for linear multi-step fallible flows instead of deep `if (!result.ok)` nesting.
- In chained flows, prefer central error handling at the end of the chain; avoid repetitive per-step error handling unless a step needs domain-specific translation.
- Prefer built-in `typescript-result` combinators over custom chaining utilities. Add custom helpers only when they encode domain logic, not generic Result behavior.
- Keep chain callbacks small and readable by extracting focused helpers (for example, one validation/transform per helper) so each `.map(...)` remains a one-liner or short block.

## Service Transaction and IO Boundaries
- Define one clear transactional boundary per service entrypoint.
- Service entrypoint flow should be:
  - Step 1 (read phase): fetch all required data up front.
  - Step 2 (compute phase): run pure business logic on in-memory data.
  - Step 3 (write phase): persist final mutations as the last step.
- Do not interleave read/write operations across inner helper calls unless the service explicitly requires multiple transactions.
- Keep repository access in top-level service functions; pass fetched data into pure helpers instead of letting helpers query storage.
- If multiple writes are required, group them in one transaction where supported by the repository/storage layer.

## Domain Import Boundaries
- For files under `src/backend/domains/*`, cross-domain imports must target only `service.ts`.
- Use alias imports (`@/backend/domains/...`) only for cross-domain service access.
- Use relative imports for same-domain internals (for example `./repository`, `./useCase`).
- Do not import another domain's internals directly (for example `@/backend/domains/projects/useCase`).

## Coding Rules
- Prefer explicit failures over silent fallbacks.
- Catch exceptions only when recovery is meaningful.
- Add runtime logs that make backend flow and failures easy to trace.
