# Domains Guidelines

## Domain File Layout
- Every domain under `src/backend/domains/<domain>/` should include:
- `service.ts` (optional): cross-domain backend API only. Create this file only when other domains need to call into this domain.
- `domainApi.ts` (optional): same-domain API used by that domain's own routes.
- `routes.ts` (optional): HTTP contracts only (request parsing, status codes, response shaping). Omit for internal-only domains with no direct HTTP API.
- `repository.ts` (optional): database persistence only.
- Omit `repository.ts` for domains with no DB persistence concerns.
- git/process/filesystem/external CLI interactions belong in `service.ts`, `domainApi.ts`, or dedicated domain helper modules invoked by them.

## Boundaries
- Routes must call only same-domain `domainApi.ts` or same-domain internal modules.
- Routes should not import same-domain `service.ts` unless the route intentionally needs the same cross-domain API contract.
- Services should call same-domain `repository.ts` for DB operations when `repository.ts` exists.
- Cross-domain imports from domain code must target only `@/backend/domains/<other-domain>/service`.
- Do not import another domain's repository or internal helpers directly.
- `service.ts` is the domain's backend-facing API surface. Export only functions that other domains need.
- If logic is used only by that domain's own routes/internal files, keep it out of `service.ts` (use `domainApi.ts` or non-exported helpers).
- Route-only route-handler dependencies must be defined in `domainApi.ts` (or same-domain internals), not exported from `service.ts`.
- When auditing `service.ts`, check both cross-domain and same-domain usage. Route-only usage does not justify a `service.ts` export.

## Migration Rule
- If a domain has legacy helper modules, keep them as internal implementation details and expose operations through `service.ts` only for cross-domain needs, and through `repository.ts` when DB persistence is involved.

## Documentation Freshness
- After every change in `src/backend/domains/*`, verify the domain `README.md` is still accurate.
- If behavior, dependencies, exposed service functions, or call flow changed, update the corresponding `README.md` in the same change.
- Keep documentation aligned with current code reality; do not defer doc updates.
- For each HTTP API route and each exported `service.ts` function documented in a domain README, include a high-level Mermaid sequence diagram.
- When user feedback changes preferred domain boundaries, update this file (and any more-specific `AGENTS.md` in scope) in the same change.
