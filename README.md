# Project Theta

<p align="center">
  <img src="https://raw.githubusercontent.com/p-sw/theta/refs/heads/master/packages/frontend/screenshot_1.png">
  <img src="https://raw.githubusercontent.com/p-sw/theta/refs/heads/master/packages/frontend/screenshot_2.png">
</p>

Modern AI chat application monorepo with a React + TypeScript frontend and a Bun + Elysia proxy backend.

## Overview

Project Theta is a monorepo managed with Bun workspaces:

```
project-theta/
├── packages/
│   ├── frontend/   # React + Vite + TypeScript app (chat UI, provider/tool system)
│   └── backend/    # Bun + Elysia proxy server (/proxy)
├── package.json    # Bun workspaces config
├── bun.lock
└── tsconfig.json
```

### Key Features

- Chat interface with session management
- Pluggable AI providers (OpenAI, Anthropic)
- Tooling system (e.g., OpenWeather) with dynamic form UI
- Streaming responses, thinking/reasoning traces, and tool-call blocks
- Backend proxy to securely call third‑party APIs from the browser

## Requirements

- Bun (latest recommended) — install from `https://bun.sh`

> Note: Use Bun instead of npm/yarn/pnpm for all commands.

## Getting Started

1. Install dependencies at the repository root:

```bash
bun install
```

2. Configure environment for the frontend (Vite):

Create `packages/frontend/.env` with the backend URL (defaults shown):

```env
VITE_BACKEND_URL=http://localhost:3000
```

3. Run the apps (two terminals):

- Backend (Elysia proxy on port 3000):

```bash
cd packages/backend
bun run dev
```

- Frontend (Vite dev server, typically on port 5173):

```bash
cd packages/frontend
bun run dev
```

Then open the frontend URL printed by Vite (e.g., `http://localhost:5173`).

## Backend Proxy API

The proxy exposes a single endpoint that forwards requests to third‑party APIs.

- POST `/proxy`
  - Request body:
    ```json
    {
      "url": "https://api.example.com/endpoint",
      "method": "POST",
      "headers": { "Authorization": "Bearer token" },
      "data": { "key": "value" }
    }
    ```
  - Returns the upstream response with headers and body. Errors from the upstream include header `x-theta-proxied: true`.

Local development command (already shown above):

```bash
cd packages/backend && bun run dev
```

## Frontend

Scripts (run inside `packages/frontend`):

- Dev: `bun run dev`
- Build: `bun run build`
- Preview (after build): `bun run preview`
- Lint: `bun run lint`

### Environment

- `VITE_BACKEND_URL` — Backend proxy base URL (e.g., `http://localhost:3000`).

### Providers and Tools

- Configure provider API keys and model options in the app under Settings → Providers.
- Tools (e.g., OpenWeather) can be enabled and configured under Settings → Tools.

## Architecture Notes

- Frontend (React + Vite):

  - Chat UI and session management in `packages/frontend/src/page/Chat.tsx` and `page/context/Chat.tsx`.
  - Provider implementations under `src/sdk/providers/` (e.g., `openai.ts`, `anthropic.ts`).
  - Tool system under `src/sdk/tools/` with provider implementations (e.g., `openweather.ts`).
  - Shared utilities in `src/sdk/shared.ts` and UI components in `src/components/ui/`.

- Backend (Bun + Elysia):
  - Minimal proxy server at `packages/backend/src/index.ts` listening on port 3000 with CORS enabled.

## Development Conventions

- Package manager: Bun only.
- TypeScript across the repo.
- Keep components focused and under ~200 lines where possible; extract UI into `components/ui/` and feature blocks into `components/block/`.
- Group imports (external → internal) and prefer absolute imports from `src/` for cross‑feature references.

## Troubleshooting

- Frontend cannot reach backend: verify `VITE_BACKEND_URL` and that the backend is listening on `localhost:3000`.
- CORS issues: the backend enables CORS via `@elysiajs/cors`; ensure you are calling through `/proxy` from the frontend.
