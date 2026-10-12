# MAST architecture

MAST is a React 19 and TypeScript single-page application built with Vite. React Router maps the implemented workbench pages and explicitly marks specialist routes as placeholders. The shared `AppLayout` provides navigation, responsive workspace chrome, and notifications.

```text
React pages → Zustand → Provider selection
                         ↙          ↘
                 Mock provider   Axios services → FastAPI /api/v1
                                    ↓                  ↓
                              in-memory JWT      Services / validation
                                                       ↓
                                            PostgreSQL via SQLAlchemy
                                                       ↓
                                      private upload storage (no public path)
```

`src/store/useAppStore.ts` owns fetched applications, findings, scans, trend data, per-resource loading/error state, detail retrieval, and demo scan status. `src/store/useUiStore.ts` owns temporary toast notifications. Presentation components consume props or store selectors; only `src/services/mockProvider.ts` imports the fixture module.

`src/services/api.ts` is the Axios client and attaches the in-memory access token. `authService`, `applicationService`, `findingService`, `scanService`, `uploadService`, `reportService`, and `dashboardService` wrap endpoint calls; React components do not issue raw HTTP requests. `dataProvider.ts` selects the mock provider or backend-backed read adapters at startup. Protected APIs verify JWT user identity and application ownership.

The authenticated frontend upload service sends a real multipart request with Axios progress and cancellation. Upload can target an owned application or create one first. The backend checks ownership before accepting bytes; an ASGI body cap and streaming file-size check enforce the configured limit, a central validator checks extension/media type/container and package markers, and ZIP metadata checks reject unsafe entries and resource-heavy archives without extracting them. Bytes are written to a private generated-name staging file, hashed as they stream, atomically moved into per-application private storage, and committed as an immutable `ApplicationVersion` with `upload_status=completed`. Same-application duplicate SHA-256 uploads return 409. DB failure removes the finalized file; validation failure removes the staging file. Upload never creates a scan. Creating a scan remains a separate endpoint and inserts only a `queued` scan and `analysis_pending` job. There is no worker, analysis, real finding generation, score computation, report renderer, or downloadable report.

The SQLAlchemy schema covers users, revoked tokens, applications, application versions, scans, scan jobs, findings, finding evidence, and reports. Alembic migrations are the schema source of truth. Deletion uses `RESTRICT` and application deletion is refused when versions or scans exist to preserve retention-ready history.

The dashboard summary API returns zero counts and empty lists for an empty database. Mock charts remain illustrative; API mode has no historical trend endpoint yet. Recharts renders the frontend visualizations. The `@` TypeScript/Vite alias points to `src`. The existing dark workstation design and responsive sidebar are retained.
