# Repository Guidelines

## Project Structure & Module Organization
- `src/index.tsx` boots the React app with Bun; `src/App.tsx` is the primary UI surface; `src/APITester.tsx` provides API interaction examples.
- Styling lives in `src/index.css` (Tailwind + DaisyUI) and SVG assets sit alongside components.
- Build tooling is in `build.ts`; project settings live in `tsconfig.json`, `bunfig.toml`, and `tailwind` configuration embedded in `src/index.css`.
- Keep new feature modules colocated under `src/` with one component per file; name shared utilities clearly (e.g., `src/utils/request.ts`).

## Build, Test, and Development Commands
- Install deps: `bun install`.
- Run locally with HMR: `bun run dev` (calls `bun --hot src/index.tsx`).
- Production start: `bun run start` (runs `src/index.tsx` with `NODE_ENV=production`).
- Build bundle: `bun run build` (executes `build.ts` to emit optimized assets).
- Tests are not yet wired; when added, prefer `bun test` and mirror Bun’s native runner.

## Coding Style & Naming Conventions
- Language: TypeScript + React function components; prefer PascalCase filenames for components and camelCase for helpers.
- Styling: favor Tailwind utility classes with DaisyUI components; keep custom CSS minimal and scoped.
