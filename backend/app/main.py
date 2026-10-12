import logging
import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings
from app.storage.file_storage import cleanup_staging_directory
from app.middleware import UploadBodyLimitMiddleware

settings = get_settings()


class JsonLogFormatter(logging.Formatter):
    safe_fields = ("event", "user_id", "application_id", "version_id", "scan_id", "resource", "resource_id", "required_role", "status_code", "sha256", "error_type")

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        payload.update({field: getattr(record, field) for field in self.safe_fields if hasattr(record, field)})
        return json.dumps(payload, separators=(",", ":"), ensure_ascii=False)


handler = logging.StreamHandler()
handler.setFormatter(JsonLogFormatter())
logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO), handlers=[handler], force=True)
logger = logging.getLogger("mast")


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.upload_directory.mkdir(parents=True, exist_ok=True)
    settings.temp_upload_directory.mkdir(parents=True, exist_ok=True)
    settings.report_directory.mkdir(parents=True, exist_ok=True)
    cleanup_staging_directory()
    yield


app = FastAPI(title="MAST Backend", version="1.0.0", description="MAST Mobile Application Security Testing API. Scan execution is not implemented in this phase.", lifespan=lifespan, docs_url=None if settings.production else "/docs", redoc_url=None if settings.production else "/redoc", openapi_url=None if settings.production else "/openapi.json")
app.add_middleware(UploadBodyLimitMiddleware)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=False, allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"], allow_headers=["Authorization", "Content-Type", "Accept"])
app.include_router(api_router)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(_: Request, exc: StarletteHTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail}, headers=exc.headers)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError):
    return JSONResponse(status_code=422, content={"detail": "Invalid request", "errors": [{"field": ".".join(str(part) for part in issue["loc"]), "message": issue["msg"]} for issue in exc.errors()]})


@app.exception_handler(Exception)
async def unexpected_exception_handler(_: Request, exc: Exception):
    logger.error("unhandled_request_error", extra={"event": "unhandled_request_error", "error_type": type(exc).__name__})
    detail = "The service encountered an unexpected error" if settings.production else "The service encountered an unexpected error"
    return JSONResponse(status_code=500, content={"detail": detail})
