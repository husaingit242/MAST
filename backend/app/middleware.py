import json
import logging
import re
from typing import Any

from app.core.config import get_settings

APPLICATION_VERSION_UPLOAD = re.compile(r"^/api/v1/applications/[0-9a-fA-F-]{36}/versions$")
MULTIPART_OVERHEAD_ALLOWANCE = 64 * 1024
audit = logging.getLogger("mast.audit")


class PayloadTooLarge(Exception):
    pass


class UploadBodyLimitMiddleware:
    """Reject oversized multipart bodies before Starlette spools the upload."""

    def __init__(self, app: Any):
        self.app = app

    async def __call__(self, scope: dict, receive: Any, send: Any) -> None:
        if scope["type"] != "http" or scope["method"] != "POST" or not APPLICATION_VERSION_UPLOAD.fullmatch(scope["path"]):
            await self.app(scope, receive, send)
            return

        max_body = get_settings().max_upload_size_mb * 1024 * 1024 + MULTIPART_OVERHEAD_ALLOWANCE
        headers = {key.lower(): value for key, value in scope.get("headers", [])}
        try:
            if int(headers.get(b"content-length", b"0")) > max_body:
                audit.warning("upload_rejected", extra={"event": "upload_rejected", "status_code": 413})
                await self._reject(send)
                return
        except ValueError:
            pass

        received = 0
        response_started = False

        async def tracked_send(message: dict) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        async def bounded_receive() -> dict:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > max_body:
                    raise PayloadTooLarge
            return message

        try:
            await self.app(scope, bounded_receive, tracked_send)
        except PayloadTooLarge:
            if not response_started:
                audit.warning("upload_rejected", extra={"event": "upload_rejected", "status_code": 413})
                await self._reject(send)

    @staticmethod
    async def _reject(send: Any) -> None:
        body = json.dumps({"detail": f"Upload exceeds the {get_settings().max_upload_size_mb} MB limit"}).encode()
        await send({"type": "http.response.start", "status": 413, "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]})
        await send({"type": "http.response.body", "body": body})
