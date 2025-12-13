# Repository Guidelines

## Project Structure & Module Organization
- Monorepo managed by Bun workspaces. Install once at the root; packages live under `packages/`.
- `packages/frontend/` — React + Vite + TypeScript app. Feature views in `src/page/`, SDK/providers in `src/sdk/`, shared UI in `src/components/`. E2E specs sit in `e2e/`; icons/assets in `icon-pack/`.
- `packages/backend/` — Bun + Elysia proxy server. Entry at `src/index.ts`; compiled binaries land in `dist/`.
- Root configs: `tsconfig.json`, `wrangler.toml`, and lockfiles. Keep env files in `packages/frontend/.env`.

## Build, Test, and Development Commands
- Install deps (root): `bun install`.
- Frontend: `cd packages/frontend`
  - Dev server: `bun run dev`
  - Build: `bun run build`
  - Preview built output: `bun run preview`
  - Lint: `bun run lint`
  - E2E tests (Playwright): `bun run test:e2e` (headful: `...:headed`, UI mode: `...:ui`)
- Backend: `cd packages/backend`
  - Dev proxy (port 3000): `bun run dev`
  - Native binaries: `bun run compile` (targets Linux x64/arm64, Windows x64)

## Coding Style & Naming Conventions
- TypeScript-first; prefer Bun tooling over npm/yarn.
- Follow ESLint rules in `packages/frontend/eslint.config.js` (notably `@typescript-eslint/no-unused-vars` with `_` ignore). Order imports external → internal; prefer absolute imports from `src/` across features.
- Components/hooks in PascalCase; utilities and functions in camelCase. Keep UI pieces focused; extract shared bits into `components/ui/` or `components/block/`.
- Use 2-space indentation and trailing commas consistent with existing files.

## Testing Guidelines
- Primary coverage via Playwright specs in `packages/frontend/e2e/`. Add cases when changing chat flows, settings, or provider/tool behavior. Keep tests idempotent and avoid real external calls beyond the proxy.
- No backend test suite today; for proxy changes, add lightweight checks or manual verification notes in the PR.

## Commit & Pull Request Guidelines
- Commit messages follow the conventional prefixes in history (`feat:`, `refactor:`, `fix:`, `chore:`). Use present tense and keep scope narrow.
- PRs should include a short summary, linked issue/task, screenshots or recordings for UI updates, and notes on env vars or migration steps.
- Run `bun run lint` and relevant tests (`bun run test:e2e` or targeted Playwright cases) before review; paste results in the PR.

## Configuration & Security Tips
- Frontend expects `VITE_BACKEND_URL` in `packages/frontend/.env` (default `http://localhost:3000`). Never commit secrets or API keys; configure providers inside the app or via local env.
- Backend proxy is permissive; when extending it, validate upstream URLs and sanitize headers to avoid open-proxy abuse.
