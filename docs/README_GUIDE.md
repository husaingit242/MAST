# MAST developer guide

## Start the frontend

1. Install Node.js 20 or newer and npm (or pnpm).
2. Install dependencies with `npm install` (or `pnpm install`).
3. Copy `.env.example` to `.env` and choose mock or API mode.
4. Run `npm run dev` and open the local URL printed by Vite.

## Environment variables

| Variable | Purpose | Default |
| --- | --- | --- |
| `VITE_USE_MOCK_DATA` | Use local development fixtures. Values other than `false` enable mock mode. | `true` |
| `VITE_API_BASE_URL` | Versioned backend API base URL. Required when mock mode is `false`. | `http://localhost:8000/api/v1` in `.env.example` |

These are public frontend settings. Never place credentials, API keys, private keys, or tokens in a `VITE_` variable; Vite embeds those values in the browser bundle.

## Data flow

Pages read data and loading/error state from `src/store/useAppStore.ts`. The store calls `src/services/dataProvider.ts`, which selects `mockProvider` or the service adapters based on `VITE_USE_MOCK_DATA`. Mock fixtures live in `src/data/mockData.ts`; UI components do not import them directly. Axios setup and safe error conversion live in `src/services/api.ts`.

In API mode, the frontend uses the FastAPI endpoints documented in [API.md](API.md). It requires a signed-in API user; access and refresh tokens stay in memory, so a page reload requires signing in again. API failures produce an error state; the app does not silently fall back to fixtures.

In mock mode, package selection is UX only and the demo status sequence is a local illustration; the file is not uploaded. In API mode, `/upload` can attach a package to an existing owned Application or create an Application first, then sends a multipart request with real Axios upload progress and cancellation. The backend validates ownership, bytes, extension, content/container, filename, platform and archive metadata; it calculates SHA-256, stores the file privately, and persists a completed immutable version. Upload never creates a Scan or ScanJob. Scan creation is separate. No analysis worker runs, and no findings or scores are fabricated.

## State and UI components

- `useAppStore` owns applications, findings, scans, trend data, async request states, and demo scan state.
- `useUiStore` owns transient notifications; it does not persist them.
- `src/components/common` contains shared loading, error, empty, notification, badge, score, progress, modal, and viewer primitives.
- `src/components/dashboard` contains dashboard charts, table, and workflow widgets.
- `src/components/layout` contains the responsive shell and navigation.
- `src/pages` contains implemented screens and explicitly marked Phase 0 placeholders.

## Routes

Implemented with current data adapters:

- `/` dashboard
- `/applications` and `/application/:id`
- `/vulnerabilities` and `/vulnerability/:id`
- `/upload` (API mode securely stores an application version only; mock mode clearly labels its separate illustrative scan demo)
- `/active-scan` and `/scans` (scan creation is a separate action; API scans remain queued because there is no worker)
- `/reports` (API mode lists request records; report generation is not implemented)

Navigation placeholders, with no specialist functionality in Phase 0:

- `/reports`, `/api-security`, `/dynamic-analysis`, `/reverse-engineering`, `/owasp`, `/settings`

Unknown routes render a dedicated 404 page. Vite's development server supports direct route refreshes.

## Commands

- `npm run dev` starts Vite.
- `npm run lint` runs Oxlint on the frontend source only.
- `npm run build` type-checks and creates a production bundle in `dist/`.
- `npm run preview` serves the production bundle locally.
