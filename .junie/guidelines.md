# Project Theta Guidelines

## Project Overview

Project Theta is a modern web application built with a monorepo structure using Bun as the JavaScript runtime. The project consists of a React frontend and an Elysia.js backend, both written in TypeScript.

## Project Structure

The project is organized as a monorepo with the following structure:

```
project-theta/
├── .junie/                  # Junie AI assistant configuration
├── node_modules/            # Root dependencies
├── packages/                # Monorepo packages
│   ├── frontend/            # React frontend application
│   │   ├── dist/            # Build output
│   │   ├── icon-pack/       # Icon assets
│   │   ├── public/          # Static assets
│   │   ├── src/             # Source code
│   │   │   ├── components/  # React components
│   │   │   ├── page/        # Page components
│   │   │   └── ...          # Other frontend code
│   │   ├── .env             # Environment variables
│   │   ├── eslint.config.js # ESLint configuration
│   │   ├── package.json     # Frontend dependencies and scripts
│   │   ├── tsconfig.json    # TypeScript configuration
│   │   └── vite.config.ts   # Vite build configuration
│   └── backend/             # Elysia.js backend application
│       ├── src/             # Source code
│       ├── package.json     # Backend dependencies and scripts
│       └── tsconfig.json    # TypeScript configuration
├── index.ts                 # Root entry point (minimal)
├── package.json             # Root dependencies and workspace configuration
└── tsconfig.json            # Root TypeScript configuration
```

## Build and Test Processes

### Frontend

The frontend is a React application built with Vite. It uses Tailwind CSS for styling and Radix UI for components.

**Scripts:**
- `bun run dev` - Start the development server
- `bun run build` - Build the application for production
- `bun run lint` - Run ESLint to check for code style issues
- `bun run preview` - Preview the production build locally

### Backend

The backend is an Elysia.js application running on Bun. It's a lightweight API server.

**Scripts:**
- `bun run dev` - Start the development server with watch mode

### Root Project

The root project uses Bun workspaces to manage the monorepo.

**Scripts:**
- `bun install` - Install dependencies for all packages
- `bun run index.ts` - Run the root entry point (minimal functionality)

## Testing

Currently, the project has minimal testing setup:
- The frontend doesn't have explicit test scripts defined
- The backend has a placeholder test script that exits with an error

When implementing tests, consider adding Jest or Vitest for the frontend and appropriate testing tools for the backend.

## Code Style Conventions

### Frontend

The frontend uses ESLint with the following configurations:
- JavaScript recommended rules
- TypeScript recommended rules
- React Hooks recommended rules
- React Refresh for Vite

**Custom Rules:**
- Unused variables are allowed if they start with an underscore (e.g., `_unused`)

### TypeScript

Both packages use TypeScript with their own tsconfig.json files. Follow the TypeScript configurations defined in these files.

## Development Workflow

1. Clone the repository
2. Run `bun install` at the root to install all dependencies
3. Start the frontend with `cd packages/frontend && bun run dev`
4. Start the backend with `cd packages/backend && bun run dev`
5. Make changes to the codebase following the code style conventions
6. Run linting with `cd packages/frontend && bun run lint` before committing changes

## Deployment

The deployment process is not explicitly defined in the project configuration. Consider adding deployment scripts or documentation as the project evolves.

## Recommendations for Junie

When working with this project, Junie should:

1. Run tests when available to check the correctness of proposed solutions
2. Follow the ESLint code style conventions, especially for the frontend
3. Consider the monorepo structure when making changes that affect multiple packages
4. Build the project before submitting results to ensure changes don't break the build
5. Use TypeScript properly according to the project's tsconfig.json files