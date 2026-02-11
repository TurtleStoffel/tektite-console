# Domains Guidelines

## Domain File Layout
- Every domain under `src/backend/domains/<domain>/` must be split into three files:
- `routes.ts`: HTTP contracts only (request parsing, status codes, response shaping).
- `service.ts`: business logic and orchestration.
- `repository.ts`: persistence and infrastructure interactions (DB, git, process, filesystem, external CLIs).

## Boundaries
- Routes must call only same-domain `service.ts`.
- Services should call same-domain `repository.ts` for data/infrastructure operations.
- Cross-domain imports from domain code must target only `@/backend/domains/<other-domain>/service`.
- Do not import another domain's repository or internal helpers directly.

## Migration Rule
- If a domain has legacy helper modules, keep them as internal implementation details and expose operations through `repository.ts`/`service.ts`.
