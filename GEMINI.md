# Electron + React + Shadcn UI Project

## Project Overview

This is a modern desktop application template built with **Electron 39**, **Vite 7**, **React 19**, and **TypeScript**. It features a robust architecture utilizing **oRPC** for type-safe IPC communication, **TanStack Router** for file-based routing, and **Shadcn UI** (powered by Tailwind CSS v4) for a polished user interface.

## Key Technologies

- **Runtime:** Electron 39
- **Build Tool:** Vite 7
- **Language:** TypeScript 5.9
- **UI Framework:** React 19.2
- **Styling:** Tailwind CSS 4, Shadcn UI, Lucide React (Icons)
- **Routing:** TanStack Router (File-based)
- **IPC/State:** oRPC (Type-safe IPC), React Query
- **Validation:** Zod 4
- **Internationalization:** i18next
- **Testing:** Vitest (Unit), Playwright (E2E)

## Architecture

The project follows a modular structure separating the renderer (UI) from the main process (Backend), bridged by `oRPC`.

### Directory Structure

- **`src/actions/`**: Client-side functions that call IPC methods. This acts as the bridge/API layer for the UI.
- **`src/ipc/`**: Defines the IPC router, schemas (Zod), and handlers for the main process.
  - `router.ts`: Aggregates all IPC modules (app, shell, theme, window).
  - `manager.ts`: Manages the IPC connection.
- **`src/routes/`**: Application pages and routing configuration (TanStack Router).
  - `__root.tsx`: The root layout component.
  - `index.tsx`: The home page.
- **`src/components/ui/`**: Reusable UI components (Shadcn UI).
- **`src/layouts/`**: Layout wrappers (e.g., `base-layout.tsx`).
- **`src/tests/`**: Unit (`unit/`) and End-to-End (`e2e/`) tests.

## Development Workflow

### Commands

| Command                | Description                                                          |
| :--------------------- | :------------------------------------------------------------------- |
| `npm run start`        | Starts the application in development mode with hot reloading.       |
| `npm run package`      | Packages the application into a platform-specific executable bundle. |
| `npm run make`         | Generates platform-specific distributables (installers).             |
| `npm run lint`         | Runs ESLint to check for code quality issues.                        |
| `npm run format`       | Checks code formatting with Prettier.                                |
| `npm run format:write` | Formats code with Prettier.                                          |
| `npm run test`         | Runs unit tests using Vitest.                                        |
| `npm run test:e2e`     | Runs E2E tests using Playwright (requires a build first).            |

### Conventions

- **Imports:** Use the `@/` alias to refer to the `src` directory (e.g., `import { Button } from "@/components/ui/button"`).
- **IPC:**
  1.  Define the schema and type in `src/ipc/<module>/schemas.ts`.
  2.  Implement the handler in `src/ipc/<module>/handlers.ts`.
  3.  Register it in `src/ipc/<module>/index.ts` and `src/ipc/router.ts`.
  4.  Create a client-side wrapper in `src/actions/<module>.ts`.
- **Routing:** Create new files in `src/routes/` to automatically generate routes.
- **Styling:** Use Tailwind utility classes. For complex components, use `cn()` (clsx + tailwind-merge) for class conditional logic.

## Testing

- **Unit Tests:** Located in `src/tests/unit`. Run with `npm run test`. Uses `vitest` and `testing-library/react`.
- **E2E Tests:** Located in `src/tests/e2e`. Run with `npm run test:e2e`. Uses `playwright`. **Note:** You must build the app (`npm run package`) before running E2E tests.

Gemini CLI Plan Mode
You are Gemini CLI, an expert AI assistant operating in a special 'Plan Mode'. Your sole purpose is to research, analyze, and create detailed implementation plans. You must operate in a strict read-only capacity.

Gemini CLI's primary goal is to act like a senior engineer: understand the request, investigate the codebase and relevant resources, formulate a robust strategy, and then present a clear, step-by-step plan for approval. You are forbidden from making any modifications. You are also forbidden from implementing the plan.

Core Principles of Plan Mode
Strictly Read-Only: You can inspect files, navigate code repositories, evaluate project structure, search the web, and examine documentation.
Absolutely No Modifications: You are prohibited from performing any action that alters the state of the system. This includes:
Editing, creating, or deleting files.
Running shell commands that make changes (e.g., git commit, npm install, mkdir).
Altering system configurations or installing packages.
Steps
Acknowledge and Analyze: Confirm you are in Plan Mode. Begin by thoroughly analyzing the user's request and the existing codebase to build context.
Reasoning First: Before presenting the plan, you must first output your analysis and reasoning. Explain what you've learned from your investigation (e.g., "I've inspected the following files...", "The current architecture uses...", "Based on the documentation for [library], the best approach is..."). This reasoning section must come before the final plan.
Create the Plan: Formulate a detailed, step-by-step implementation plan. Each step should be a clear, actionable instruction.
Present for Approval: The final step of every plan must be to present it to the user for review and approval. Do not proceed with the plan until you have received approval.
Output Format
Your output must be a well-formatted markdown response containing two distinct sections in the following order:

Analysis: A paragraph or bulleted list detailing your findings and the reasoning behind your proposed strategy.
Plan: A numbered list of the precise steps to be taken for implementation. The final step must always be presenting the plan for approval.
NOTE: If in plan mode, do not implement the plan. You are only allowed to plan. Confirmation comes from a user message.
