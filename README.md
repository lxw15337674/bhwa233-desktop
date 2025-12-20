# bhwa233-tools-desktop

A modern desktop application built with **Electron**, **React**, and **Shadcn UI**. This project utilizes **Vite** for fast build times and **oRPC** for type-safe IPC communication.

## Tech Stack 🛠️

### Core
- [Electron 39](https://www.electronjs.org)
- [Vite 7](https://vitejs.dev)
- [TypeScript 5.9](https://www.typescriptlang.org)

### UI & Styling
- [React 19.2](https://reactjs.org)
- [Tailwind CSS 4](https://tailwindcss.com)
- [Shadcn UI](https://ui.shadcn.com)
- [Lucide React](https://lucide.dev)
- [TanStack Router](https://tanstack.com/router)
- [i18next](https://www.i18next.com)

### Backend & State
- [oRPC](https://orpc.unnoq.com) (Type-safe IPC)
- [TanStack Query](https://tanstack.com/query)
- [Zod 4](https://zod.dev)

### Testing
- [Vitest](https://vitest.dev)
- [Playwright](https://playwright.dev)

## Getting Started 🚀

### Prerequisites
- Node.js (v22 recommended)
- pnpm (managed via Corepack or `npm install -g pnpm`)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd bhwa233-desktop
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Start the development server:
   ```bash
   pnpm start
   ```

## Scripts 📜

| Command | Description |
| :--- | :--- |
| `pnpm start` | Starts the application in development mode. |
| `pnpm package` | Packages the application into an executable bundle. |
| `pnpm make` | Generates platform-specific installers (e.g., .exe, .msi). |
| `pnpm lint` | Runs ESLint to catch code quality issues. |
| `pnpm format` | Checks code formatting with Prettier. |
| `pnpm format:write` | Formats code with Prettier. |
| `pnpm test` | Runs unit tests with Vitest. |
| `pnpm test:e2e` | Runs E2E tests with Playwright (requires build). |

## Directory Structure 📂

```plaintext
src/
├── actions/       # Client-side IPC wrappers (Bridge layer)
├── assets/        # Static assets (fonts, images)
├── components/    # React components
│   └── ui/        # Shadcn UI components
├── constants/     # Global constants
├── ipc/           # Main process handlers & Zod schemas (oRPC)
├── layouts/       # Page layouts
├── localization/  # i18n configuration
├── routes/        # TanStack Router pages
├── styles/        # Global CSS (Tailwind)
├── tests/         # Unit and E2E tests
├── types/         # TypeScript type definitions
└── utils/         # Utility functions
```

## Architecture

This project uses **oRPC** to bridge the Electron Main process and the Renderer process.
- **IPC Handlers**: Defined in `src/ipc/` (Server-side).
- **Actions**: Defined in `src/actions/` (Client-side).

## License

MIT