# MAST backend (Phase 2)

FastAPI + SQLAlchemy + Alembic backend for MAST. Phase 2 implements authenticated owner-scoped application-package uploads, server validation, SHA-256 hashing, private staging/final storage, version metadata, duplicate detection, and the Phase 1 account/application APIs. **There is no analyzer, worker, report renderer, or vulnerability generation.**

## Local PostgreSQL development

Requirements: Python 3.12+, Docker Compose, and Node.js 20+ for the frontend.

From the repository root:

```powershell
Copy-Item backend/.env.example backend/.env
```

Replace `JWT_SECRET_KEY` in the local environment file with a fresh random secret and use a non-default `POSTGRES_PASSWORD` before sharing the environment. These sample values are development-only. Then start PostgreSQL and the API:

```powershell
docker compose up --build
```

The backend container waits for PostgreSQL, runs `alembic upgrade head`, then serves `http://localhost:8000`. Swagger UI is at `/docs`; OpenAPI is at `/openapi.json`.

The frontend stays in mock mode by default. To use API mode, set the root frontend `.env`:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_USE_MOCK_DATA=false
```

Restart Vite after changing environment variables. API mode requires signing in or registering an analyst. Frontend access/refresh tokens remain in memory; a browser reload asks the user to sign in again.

## Python setup and migrations

Create an isolated virtual environment, install the root requirements, copy the example environment, then migrate and start the API:

```powershell
python -m venv backend/.venv
backend/.venv/Scripts/Activate.ps1
python -m pip install -r requirements.txt
Copy-Item backend/.env.example backend/.env
Push-Location backend
python -m alembic upgrade head
python -m uvicorn app.main:app --reload --port 8000
Pop-Location
```

PostgreSQL is the Compose default. If `DATABASE_URL` is unset, the API uses SQLite for isolated local smoke checks; the same Alembic migration is applied. Do not use the weak development secret outside local work. The Compose backend uses the development `APP_ENV` unless configured otherwise.

## Tests

From the repository root:

```powershell
python -m pytest backend/tests -q
```

Tests use an isolated in-memory SQLite database and temporary private upload/staging storage. They exercise registration/login/refresh/logout, owner isolation, CRUD, all four upload types, content/size/name checks, hash/status/deduplication, cleanup, queued scan lifecycle, findings/reports foundations, dashboard, health, and API docs.

## Environment

See `.env.example` for `DATABASE_URL`, JWT key/algorithm and expiry, upload cap, allowed package suffixes, private final and temporary storage directories, report directory, CORS allowlist, and logging level. Never commit `.env`. Do not expose these values through `VITE_*` variables.

## Phase limits

- `POST /api/v1/applications/{application_id}/versions` accepts authenticated multipart APK/AAB/IPA/ZIP files. It checks ownership, allowed suffix, declared media type, archive/container markers, archive metadata, filename, platform and configurable size; it hashes while streaming into generated-name private staging, then moves into per-application private storage and persists an immutable completed version. Duplicate same-application hashes return 409.
- Uploads are never extracted or executed. ZIP checks are metadata-only and are not malware detection. There is no public URL or download endpoint. Invalid uploads are not recorded as successful versions; handled failures remove temporary/final files. Staging files older than 24 hours are cleaned on startup.
- A request-body guard rejects uploads above the configured limit plus multipart overhead before Starlette parses/spools them; the upload service also checks actual file bytes while copying. Configure a matching reverse-proxy cap for production.
- An upload does not create a Scan or ScanJob. Scan creation is a separate API action.
- Scan creation only writes `Scan(status=queued)` and `ScanJob(status=queued, job_type=analysis_pending)`. There is no queue consumer.
- Backend audit events are emitted as JSON records for authentication, authorization denials, uploads, application changes, and scan operations. Tokens, passwords, and file contents are excluded.
- No seed users/findings are inserted. Registration assigns `analyst`; admin role assignment is out of band.
- Reports are metadata requests with status `not_implemented`; there is no download route or renderer.
- Email verification, MFA, throttling, account recovery, comprehensive audit history/retention cleanup, object-store encryption, antivirus/quarantine, reverse-proxy/TLS hardening, and production monitoring remain deployment or future work.

Full endpoint details: [`docs/API.md`](../docs/API.md). See also [`docs/SECURITY.md`](../docs/SECURITY.md).
