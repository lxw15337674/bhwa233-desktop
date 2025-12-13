# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Electron desktop application using React, TypeScript, and shadcn/ui. The project uses **oRPC** for type-safe IPC communication between the main and renderer processes.

## Commands

```bash
pnpm start           # Start in development mode with hot reloading
pnpm lint            # Run ESLint
pnpm format          # Check formatting with Prettier
pnpm format:write    # Format code with Prettier
pnpm test            # Run unit tests (Vitest)
pnpm test:watch      # Run unit tests in watch mode
pnpm test:e2e        # Run E2E tests (Playwright) - requires build first
pnpm package         # Package into executable bundle
pnpm make            # Generate platform-specific distributables
```

## Architecture

### IPC Communication (oRPC)

The app uses oRPC for type-safe IPC between renderer and main processes:

1. **Main process** (`src/main.ts`): Sets up the oRPC handler via MessagePort
2. **Preload** (`src/preload.ts`): Bridges IPC channels between processes
3. **Client** (`src/ipc/manager.ts`): `IPCManager` class manages the oRPC client connection

**Adding a new IPC module:**
1. Create schema in `src/ipc/<module>/schemas.ts` using Zod
2. Implement handlers in `src/ipc/<module>/handlers.ts` using `os.handler()`
3. Export handlers in `src/ipc/<module>/index.ts`
4. Register in `src/ipc/router.ts`
5. Create client wrapper in `src/actions/<module>.ts` using `ipc.client.<module>.method()`

Existing IPC modules: `app`, `shell`, `theme`, `window`, `media`

### Routing (TanStack Router)

File-based routing in `src/routes/`:
- `__root.tsx`: Root layout wrapping all routes
- `index.tsx`: Home page (`/`)
- Create new files to add routes automatically

Route tree is auto-generated in `src/routeTree.gen.ts`.

### UI Components

- shadcn/ui components in `src/components/ui/`
- Use `cn()` utility from `src/utils/tailwind.ts` for conditional class merging
- Tailwind CSS v4 for styling

### Internationalization

i18next configured in `src/localization/i18n.ts` with inline translations for `en` and `pt-BR`.

## Key Patterns

- **Path alias**: Use `@/` to reference `src/` directory
- **Theme**: Synced between Electron's `nativeTheme` and document class (`dark`/`light`)
- **Main entry**: `src/main.ts` (Electron main process)
- **Renderer entry**: `src/App.tsx` (React app entry point)
- **Preload**: `src/preload.ts` (exposes `electron` and `media` APIs to renderer)

## Testing

- Unit tests: `src/tests/unit/` - uses Vitest with jsdom + React Testing Library
- E2E tests: `src/tests/e2e/` - uses Playwright (build app first with `pnpm package`)
- Test setup: `src/tests/unit/setup.ts`
