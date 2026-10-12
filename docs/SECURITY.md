# Security notes

MAST Phase 2 adds authenticated package intake, server-side validation, immutable version metadata, SHA-256 hashes, and private storage. It is still not a scanner. Mock-mode findings, scores, trend data, and demo scan state remain illustrative only. API mode does not create fabricated findings or scores.

- Browser validation checks file name, extension, non-empty size, and a 500 MB UX limit. It is not a security boundary; server limits are configurable and authoritative.
- Authenticated package upload uses the application API. Ownership is verified on the backend. Upload requests are capped before multipart spooling where possible and the upload service enforces the byte limit while copying in chunks.
- Never put credentials, API keys, private keys, or other secrets in frontend source or `VITE_` environment variables; Vite exposes them to users.
- Scan and finding text is rendered through React text nodes. Do not add `dangerouslySetInnerHTML` for backend-controlled values.
- API passwords use Argon2id through pwdlib. Access and refresh JWTs have short configured lifetimes, refresh rotation, and per-user token-version invalidation on logout. Tokens are not persisted by the frontend.
- Every protected application-related API checks the authenticated owner. A user cannot access another user's apps, versions, scans, findings, or reports.
- Uploads are restricted by configured extension and declared media type, checked as ZIP containers with APK/AAB/IPA markers without extracting, named using server-generated UUIDs, SHA-256 hashed during streaming, and kept outside static assets. Temporary uploads are isolated and stale staging files are purged after 24 hours. No download endpoint is exposed.
- ZIP central-directory metadata is inspected without extraction. Entry count, total uncompressed size, compression ratio, duplicate paths, traversal paths, absolute paths, and symlinks have limits/checks. This does not detect malware or establish archive safety for future extraction.
- Database deletions use restrictive foreign keys. Full retention schedules and audit history are not implemented.
- Backend operational/audit events use JSON log records and omit passwords, tokens, and uploaded file contents.
- This phase has no login rate limit, email verification, password reset, MFA, refresh-token device/session management, antivirus/quarantine, production TLS/reverse-proxy configuration, or object-store encryption. The application caps upload request bytes before Starlette multipart spooling when possible; configure a matching reverse-proxy body limit for production as well.
- Uploaded packages are stored as untrusted data; no APK/IPA tooling, execution, extraction, malware detection, or security analysis runs. An upload is not a scan and creates no scan record.
- API authentication, authorization, upload validation, retention, and throttling must be enforced server-side; frontend checks are only UX.
- API mode reports connection and response errors instead of masking them with mock data.
