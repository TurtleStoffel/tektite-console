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
- For any new or changed client server-state fetches, use React Query (`useQuery`, `useMutation`, invalidation/refetch). Do not introduce `useEffect + fetch + useState` patterns for remote data.
- Use React Router for client routing.
- Style with Tailwind utility classes and DaisyUI components.
- Prefer explicit failures over hidden defaults.
- Add logs that help trace important UI/runtime behavior.
- If the user gives architecture/process feedback during a client task, update the relevant `AGENTS.md` file in the same change to persist that preference.

## Design patterns that scale in React
1. `Data down, events up`

Parent owns state that multiple children care about.

Parent passes data as props to children.

Children report user intent via callbacks (`onSelect`, `onChange`, etc.).

2. Use effects for side effects, not state plumbing

Good `useEffect` cases:
- Fetching and mutations when not already handled by a data library.
- Subscriptions (WebSocket, DOM events, external listeners).
- Timers and intervals.
- Imperative DOM interactions only when needed (prefer refs and declarative UI first).

Avoid:
- "When prop `X` changes, set state `Y`" when `Y` can be derived during render.
- Keeping two state values synchronized when one can be a single source of truth.

3. Split components by responsibility, not just by markup

If a split introduces many props/callbacks, the boundary is likely too low-level.

Prefer a feature/container component that owns closely-related UI state and actions, and pass a smaller, stable API to presentational children.

When in doubt, reduce prop drilling before adding more wrapper components.

4. Keep React components reasonably small
- When a component grows beyond a reasonable review size (roughly 200-250 lines), split it into focused child components by responsibility.
- Keep container/page components responsible for orchestration and state ownership, and move dense UI blocks (tables, panels, canvases, forms) into dedicated components.
