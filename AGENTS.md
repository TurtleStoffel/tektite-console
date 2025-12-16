# Repository Guidelines

## Project Structure & Module Organization
- `src/index.tsx` boots the React app with Bun; `src/App.tsx` is the primary UI surface.

## Coding Style
- Language: TypeScript + React function components
- Styling: favor Tailwind utility classes with DaisyUI components
- Prefer failing hard over catching errors and setting defaults, only catch exceptions if you can meaningfully recover from the error
- Add logs that make it easier to understand what is happening at runtime
