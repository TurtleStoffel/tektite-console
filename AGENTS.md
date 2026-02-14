# Repository Guidelines

## Project Structure & Module Organization
- `src/index.tsx` is the Bun server entrypoint.
- `src/client/frontend.tsx` boots the React app.
- `src/client/App.tsx` is the primary UI surface.
- `src/backend/*` contains backend routes, business logic, and storage integrations.
- `src/shared/*` contains shared modules used by both client and backend.

## Shared Code Rules
- Put code in `src/shared/*` only when both client and backend use it.
- If code is frontend-only, keep it in `src/client/*`.
- If code is backend-only, keep it in `src/backend/*`.

## Coding Style
- Language: TypeScript + React function components
- Styling: favor Tailwind utility classes with DaisyUI components
- Prefer failing hard over catching errors and setting defaults, only catch exceptions if you can meaningfully recover from the error
- Add logs that make it easier to understand what is happening at runtime

## Libraries & Tooling
- Zod for input validation
- React Query for state management
- React Router for routing
- Tailwind + DaisyUI for styling

## Architecture
- Use the standard 3-layer architecture:
  - Routes define the APIs.
  - Services define the business logic.
  - Repositories interact with the database only.

## Completion Checklist
- When you are finished, run `bun run format`.
- Then run `bun run lint`.
- Then run `bun run typecheck`.
- Do not run `format` and `lint` in parallel; run them sequentially to avoid stale-file race conditions.
- Fix any issues reported by these commands before considering the task complete.
