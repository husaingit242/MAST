# MAST API v1

FastAPI serves interactive documentation in development at `/docs`, `/redoc`, and `/openapi.json`. All application APIs are under `/api/v1`. Except for health, registration, and login/refresh/logout, requests require `Authorization: Bearer <access_token>`.

## Authentication and users

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/auth/register` | Creates an analyst account and returns access/refresh tokens. Password: 12+ chars with upper/lowercase and a number. |
| POST | `/auth/login` | Accepts `{ "username": "name or email", "password": "..." }`. |
| POST | `/auth/refresh` | Rotates a refresh token; old version becomes invalid. |
| GET | `/auth/me` | Current user. |
| POST | `/auth/logout` | Revokes token version for the account. |
| GET / PATCH | `/users/me` | Read/update current user's full name. |
| GET | `/users`, `/users/{id}` | Admin-only user listing and detail. |

Registration creates the `analyst` role. No public endpoint can grant admin; role assignment is an operator-controlled deployment task.

## Applications and versions

| Method | Path | Notes |
| --- | --- | --- |
| GET / POST | `/applications` | Owner-scoped, paginated list / create. |
| GET / PATCH / DELETE | `/applications/{id}` | Owner-scoped; deletion returns 409 when versions or scans are retained. |
| GET | `/applications/{id}/versions` | Owner-scoped metadata only. |
| POST | `/applications/{id}/versions` | Authenticated, owner-scoped multipart `file`; optional `version_name` and `version_code` are unverified user metadata. Supports APK, AAB, IPA, ZIP. Checks extension, declared media type and package/container content, server byte cap, filename/path characters, archive metadata, and platform compatibility. Computes SHA-256, stores privately, then returns immutable version metadata. Same application + same hash returns 409. No Scan is created. |

Successful response includes `id`, `application_id`, `original_filename`, `file_size`, `file_hash` (SHA-256), `file_type` (`APK`, `AAB`, `IPA`, `ZIP`), `upload_status` (`completed`), and `created_at`. It never includes absolute paths or generated storage names. The configurable default maximum is `MAX_UPLOAD_SIZE_MB=500`; `UPLOAD_DIRECTORY`, `TEMP_UPLOAD_DIRECTORY`, and `ALLOWED_UPLOAD_EXTENSIONS` configure private storage and accepted suffixes. ZIP files are inspected without extraction. Upload validation is not malware detection.

Only successful uploads are persisted as completed application versions. Preparing/uploading/processing are transient frontend states; rejected or failed requests do not leave a version record. A browser cancellation aborts its HTTP request, though an upload already accepted by the server may finish concurrently with the cancellation.

Application create body: `name`, `package_name`, `platform` (`Android` or `iOS`), optional `description`. List endpoints use `{items,total,limit,offset}`.

## Scans, findings, reports

| Method | Path | Notes |
| --- | --- | --- |
| GET / POST | `/scans` | Paginated owned scans / create a `queued` Scan and ScanJob for an owned version. |
| GET | `/scans/{id}` | Owner-scoped scan status. |
| POST | `/scans/{id}/cancel` | Cancels queued jobs only. |
| GET | `/findings` | Paginated; optional `severity`, `status`, `application_id`, `scan_id`, `category` filters. Empty unless records are explicitly created by a later phase. |
| GET / PATCH | `/findings/{id}` | Owner-scoped read / status update. |
| GET | `/findings/{id}/evidence` | Owner-scoped evidence metadata; filesystem paths are never returned. |
| GET / POST | `/reports` | List owner-scoped reports / create a report request with status `not_implemented`. |
| GET | `/reports/{id}` | Owner-scoped report metadata. |

No scan worker exists. Scan jobs remain queued (or may be cancelled); report requests do not generate a file.

## Dashboard and health

- `GET /dashboard/summary` returns counts and recent owner-scoped records, with zero counts and empty arrays for an empty database.
- `GET /health` returns the service status without infrastructure details.
- `GET /health/database` performs a basic database connectivity check.

IDs are generated UUID strings. Errors use a JSON `detail` field; validation errors include `detail: "Invalid request"` and field-level messages. Unexpected production errors do not return stack traces.
