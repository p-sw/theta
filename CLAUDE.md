# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Project Theta is a monorepo chat application with AI provider integration. It uses Bun as the runtime and package manager, with a React/Vite frontend and Elysia.js backend.

**Architecture**: Monorepo with workspaces for `backend` and `frontend` packages
- **Frontend**: React + TypeScript + Vite with Tailwind CSS and Radix UI components
- **Backend**: Elysia.js server acting as API proxy for AI providers
- **Runtime**: Bun for package management and execution

## Development Commands

### Root Level Commands
```bash
bun install                 # Install all dependencies
bun run index.ts           # Run main entry point
```

### Frontend (packages/frontend)
```bash
bun dev                    # Start Vite dev server
bun run build              # Build for production (runs TypeScript check + Vite build)
bun run lint               # Run ESLint
bun preview                # Preview built app
```

### Backend (packages/backend)
```bash
bun run dev                # Start dev server with watch mode
```

## Key Architecture Patterns

### AI Provider SDK Architecture
The application uses a **provider-based abstraction pattern** for AI integration:

- **`AISDK` singleton**: Central provider registry and management (frontend/src/sdk/index.ts)
- **`API<T>` abstract class**: Base class all providers extend (frontend/src/sdk/shared.ts)
- **Provider implementations**: Located in frontend/src/sdk/providers/ (currently Anthropic)
- **Proxy architecture**: All AI API calls routed through backend at `/proxy` endpoint

### Session Management
- **Temporary sessions**: sessionStorage, cleared on page refresh
- **Permanent sessions**: localStorage, persisted across sessions
- **Turn-based structure**: Request/response pairs with unique message IDs using hyperid

### Component Structure
- **UI components**: Radix UI + Tailwind, located in frontend/src/components/ui/
- **Block components**: Chat-specific components in frontend/src/components/block/
- **Layout components**: App structure in frontend/src/components/layout/
- **Pages**: Main application views in frontend/src/page/

### Storage & State Management
- **`useStorage` hook**: Reactive localStorage/sessionStorage with event-driven updates
- **Chat context**: React context for session state management
- **Model selection**: Persistent provider/model combinations in storage

## Adding New AI Providers

1. Add provider to `IProvider` type union in frontend/src/sdk/shared.ts
2. Create provider implementation extending `API<T>` in frontend/src/sdk/providers/
3. Add provider types file (e.g., `provider.types.ts`)
4. Register in `providerRegistry` in frontend/src/sdk/index.ts
5. Add case in `AISDK.message()` switch statement
6. Update model constants in frontend/src/lib/const.ts

## Error Handling Patterns

- **`ExpectedError`**: User-facing errors with status codes
- **`ServerSideHttpError`**: Backend/proxy errors  
- **`ClientSideHttpError`**: Network/client errors
- **Provider-specific errors**: Custom error classes extending base types

## Testing & Quality
- No test suite currently configured
- ESLint configured for frontend package
- TypeScript strict mode enabled