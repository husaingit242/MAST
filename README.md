# MAST

**Mobile Application Security Testing** (MAST) is a security workstation for managing mobile application records, uploads, queued scan jobs, findings, and report requests.

> Phase 2 implements authenticated mobile package intake, server-side validation, SHA-256 hashing, private storage, and upload metadata. Uploaded applications are not yet automatically security-analyzed. Mock mode still shows illustrative sample data; it must not be treated as real security analysis.

## Features

- Security overview dashboard with portfolio statistics and severity charts
- Application inventory with platform, version, security score, and scan status
- Vulnerability list with severity, category, application, and affected file
- Authenticated upload of APK, AAB, IPA, and ZIP packages to private backend storage
- Scan history and a clearly labeled mock scan flow (upload itself never starts a scan)
- Responsive workstation layout
- Axios API client foundation and Zustand app state
- FastAPI REST API, JWT authentication, PostgreSQL, and Alembic migrations
- Owner-scoped application, version-upload, scan-job, finding, report, and dashboard endpoints

## Technology

- React 19 and TypeScript
- Vite
- React Router
- Zustand
- Recharts
- Axios
- Lucide icons
- FastAPI, SQLAlchemy, Alembic, Pydantic, PostgreSQL, JWT, and Argon2

## Requirements

- Node.js 20 or newer
- npm or pnpm
- Python 3.12 or newer
- Docker Compose (for the PostgreSQL development stack)

## Getting started

```bash
git clone <repository-url>
cd MAST
npm install
```

Mock mode is on by default. Start the backend using the steps in [Backend setup](backend/README.md) to use API mode. Do not put secrets in frontend `VITE_` environment variables.

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_USE_MOCK_DATA=true
```

Start the development server:

```bash
npm run dev
```

Vite prints the local URL, normally `http://localhost:5173/`.

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check the app and create a production build in `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run Oxlint |

## Main routes

| Route | Screen |
| --- | --- |
| `/` | Security overview |
| `/applications` | Application inventory |
| `/application/:id` | Application details |
| `/upload` | Add an application |
| `/active-scan` | Demo simulation in mock mode; queued job status in API mode |
| `/scans` | Scan history |
| `/vulnerabilities` | Findings list |
| `/vulnerability/:id` | Finding details |
| `/reports` | Report requests; generation is not implemented |
| `/api-security` | API security placeholder |
| `/dynamic-analysis` | Dynamic analysis placeholder |
| `/reverse-engineering` | Reverse engineering placeholder |
| `/owasp` | OWASP mobile top 10 placeholder |
| `/settings` | Settings placeholder |

Several specialist routes currently share a placeholder screen while their feature-specific workflows are being built.

## Project structure

```text
src/
├── components/
│   ├── common/       # Shared badges, viewers, modal, progress, and score UI
│   ├── dashboard/    # Dashboard tables, charts, and workflow widgets
│   └── layout/       # Sidebar and application shell
├── data/             # Illustrative local data
├── pages/            # Route-level screens
├── services/         # Axios API client
├── store/            # Zustand app and scan state
└── types/            # TypeScript domain interfaces
docs/                 # Developer guide, architecture, and security notes
public/               # Static icons and favicon
```

## Data modes and backend integration

Mock mode is on by default. To use API mode, configure `VITE_API_BASE_URL` and set `VITE_USE_MOCK_DATA=false`, then sign in. API mode does not fall back to sample data on errors. The upload page supports an existing owned application or creates a new application before uploading. The upload is separate from scan creation.

All current sample applications, findings, scans, and trend points are isolated in `src/data/mockData.ts`, accessed through the mock provider. The mock demo scan is a local illustrative status simulation and does not inspect or upload the selected file. Browser upload checks are for user guidance only; the backend repeats authoritative checks.

See [the Phase 0 developer guide](docs/README_GUIDE.md) for state/data flow, configuration, known placeholders, and commands. Never place secrets in `VITE_` environment variables.

The `Mobile-Security-Framework-MobSF/` directory in this workspace is a separate MobSF checkout. MAST does not integrate with it. APK/AAB/IPA/ZIP uploads are validated, hashed, and stored privately but never extracted, executed, or analyzed. Uploading does not create a Scan or ScanJob. Creating a scan separately inserts a `queued` Scan and ScanJob only. Findings are empty unless later inserted by a future analysis phase; no seed vulnerabilities are created.

## Backend

See [Backend setup and limitations](backend/README.md), [API documentation](docs/API.md), [architecture](docs/ARCHITECTURE.md), and [security notes](docs/SECURITY.md). The backend defaults to SQLite for lightweight local checks when `DATABASE_URL` is not set; Docker Compose uses PostgreSQL. Use Alembic migrations to create all tables.

## Documentation

- [Developer guide](docs/README_GUIDE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security notes](docs/SECURITY.md)
