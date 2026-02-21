# Domains Guidelines

## Domain File Layout
- Every domain under `src/backend/domains/<domain>/` should include:
- `service.ts`: business logic and orchestration.
- `routes.ts` (optional): HTTP contracts only (request parsing, status codes, response shaping). Omit for internal-only domains with no direct HTTP API.
- `repository.ts` (optional): database persistence only.
- Omit `repository.ts` for domains with no DB persistence concerns.
- git/process/filesystem/external CLI interactions belong in `service.ts` or dedicated domain helper modules invoked by `service.ts`.

## Boundaries
- Routes must call only same-domain `service.ts`.
- Services should call same-domain `repository.ts` for DB operations when `repository.ts` exists.
- Cross-domain imports from domain code must target only `@/backend/domains/<other-domain>/service`.
- Do not import another domain's repository or internal helpers directly.

## Migration Rule
- If a domain has legacy helper modules, keep them as internal implementation details and expose operations through `service.ts`, and through `repository.ts` when DB persistence is involved.

## Documentation Freshness
- After every change in `src/backend/domains/*`, verify the domain `README.md` is still accurate.
- If behavior, dependencies, exposed service functions, or call flow changed, update the corresponding `README.md` in the same change.
- Keep documentation aligned with current code reality; do not defer doc updates.
