# Repository Guidelines

## Project Structure & Module Organization
- `src/index.tsx` boots the React app with Bun; `src/App.tsx` is the primary UI surface.

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
  - Repositories interact with the database.
