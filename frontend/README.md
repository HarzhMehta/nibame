# nibame Frontend

Welcome to the frontend application for **nibame** — a privacy-first personal context engine and second brain.

This frontend establishes the foundation and core application shell for capturing, organizing, connecting, and retrieving personal context.

## Tech Stack

- **Framework**: [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler & Tooling**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Routing**: [React Router](https://reactrouter.com/) (client-side routing)
- **Testing**: [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/)

## Getting Started

### Prerequisites

- Node.js `v18+` (recommended: v20 or v22)
- npm `v9+`

### Installation

From the repository root or the `frontend` directory:

```bash
cd frontend
npm install
```

### Running the Development Server

Start the local development server:

```bash
npm run dev
```

By default, Vite will start the app at `http://localhost:5173`. Open this URL in your browser.

### Running Tests

Run the Vitest test suite in single-run mode:

```bash
npm run test:run
```

To run tests in interactive watch mode:

```bash
npm run test
```

### Type Checking and Production Build

Check for TypeScript errors:

```bash
npm run typecheck
```

Build the production bundle (emits to `dist/`):

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Directory Structure

```text
frontend/
├── public/                # Static public assets (e.g., favicon)
├── src/
│   ├── components/
│   │   ├── ui/            # Reusable UI primitives (Button, Input, Textarea, Card, Badge, Modal, EmptyState, LoadingSpinner)
│   │   ├── layout/        # Shell layout components (AppLayout, Sidebar, Header, MobileNav)
│   │   └── common/        # Shared domain components (CaptureModal, ItemCard, EntityCard)
│   ├── pages/             # Route pages:
│   │   ├── InboxPage.tsx  # Universal inbox ("capture first, organize later")
│   │   ├── MemoryPage.tsx # Entities and relationship exploration
│   │   └── SearchPage.tsx # Fast local search over items and entities
│   ├── context/           # React state context (BrainContext)
│   ├── routes/            # Client-side route declarations
│   ├── services/          # Service layer abstraction (captureService, memoryService, searchService)
│   ├── types/             # Frontend domain type definitions (MemoryItem, Entity, Relationship, etc.)
│   ├── data/              # Static / mock seed data (mockItems, mockEntities)
│   ├── lib/               # Utility functions (cn, date formatters, type detection)
│   ├── styles/            # Global styles and Tailwind configuration
│   ├── tests/             # Automated unit & integration tests
│   ├── App.tsx            # Root application component
│   └── main.tsx           # Application entrypoint
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Architecture & Service Abstraction

To ensure that future backend services (such as persistent storage, graph engines, vector retrieval, or background ingestion workers) can be plugged in seamlessly, the UI components do **not** interact directly with mock data.

Instead, the application follows a strict layered separation:

```text
UI Components / Pages
        ↓
   useBrain() Hook / BrainContext
        ↓
  Service Abstraction Layer (`services/`)
    - captureService.ts
    - memoryService.ts
    - searchService.ts
        ↓
  Mock Data Layer (`data/`)  ───► [Future: Backend REST / GraphQL / gRPC API]
```

When backend APIs are ready, only the methods inside `src/services/` will be updated to make HTTP/WebSocket calls. The UI components will remain unchanged.

## Keyboard Shortcuts

- `Ctrl + K` or `Cmd + K`: Open the Capture Modal from anywhere.
- `C` (when not typing in an input): Quick-trigger the Capture Modal.
- `Esc`: Close open modals or dialogs.
