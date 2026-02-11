# Client Guidelines

## Structure
- `src/client/frontend.tsx`: React entrypoint and providers.
- `src/client/App.tsx`: top-level app shell and route mounting.
- `src/client/*.tsx`: pages and reusable UI components.
- `src/client/project-details/*`: project details feature modules.
- `src/client/types/*`: client-only shared types.
- `src/client/utils/*`: client-only helper utilities.
- `src/client/index.html` and `src/client/index.css`: client HTML and global styles.
- Cross-runtime modules live in `src/shared/*` (not under `src/client/*`).

## Coding Rules
- Language: TypeScript + React function components.
- Use React Query for server state and caching.
- Use React Router for client routing.
- Style with Tailwind utility classes and DaisyUI components.
- Prefer explicit failures over hidden defaults.
- Add logs that help trace important UI/runtime behavior.
