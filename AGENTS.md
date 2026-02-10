# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains application code; entry points are `src/main.tsx` and `src/App.tsx`.
- `src/hooks/` holds custom React hooks (MQTT logic lives here).
- `src/lib/` provides shared utilities; `src/types/` defines TypeScript models.
- `src/assets/` is for bundled assets; `public/` is for static files copied as-is.
- `dist/` is generated build output.
- Root configs: `vite.config.ts`, `tsconfig*.json`, `tailwind.config.cjs`, `eslint.config.js`.

## Build, Test, and Development Commands
Use npm (lockfile is committed).
```bash
npm install
npm run dev      # Vite dev server with HMR
npm run build    # TypeScript build + Vite production bundle
npm run preview  # Serve dist locally
npm run lint     # ESLint checks for TS/TSX
```

## Coding Style & Naming Conventions
- TypeScript + React functional components.
- Indentation is 2 spaces; prefer single quotes; avoid semicolons to match existing files.
- Components and types use PascalCase (`StatusBadge`, `PsdkStatePayload`).
- Hooks are named `useX` and live in `src/hooks/`.
- Constants use SCREAMING_SNAKE_CASE when shared (`MAX_LOGS`).
- Tailwind utility classes are composed inline; keep them grouped and readable.

## Testing Guidelines
- No automated test runner is configured yet (no Jest/Vitest script).
- If you add tests, colocate under `src/` (e.g., `src/lib/__tests__/...`) and add a `npm run test` script.

## Commit & Pull Request Guidelines
- Commit history uses Conventional Commits (`feat:`, `chore:`). Example: `feat: add mqtt reconnect backoff`.
- PRs should include a brief summary, how to test (commands + expected result), and screenshots for UI changes.
- Call out any `.env` key additions or behavior changes in the PR description.

## Configuration & Secrets
- Local settings live in `.env` with `VITE_` prefixes (e.g., `VITE_MQTT_URL`).
- Do not commit secrets; keep `.env` local and document required keys when adding new ones.
