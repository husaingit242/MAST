import hashlib
import os
import re
import stat
import time
import zipfile
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile

from app.core.config import get_settings

ALLOWED_EXTENSIONS = {f".{extension}" for extension in get_settings().allowed_upload_extensions}
ALLOWED_CONTENT_TYPES = {
    "application/vnd.android.package-archive", "application/octet-stream", "application/zip",
    "application/x-zip-compressed", "application/java-archive", "application/x-itunes-ipa",
}
ZIP_SIGNATURES = (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08")
MAX_ARCHIVE_ENTRIES = 20_000
MAX_ARCHIVE_UNCOMPRESSED_BYTES = 2 * 1024 * 1024 * 1024
MAX_COMPRESSION_RATIO = 200
SAFE_NAME = re.compile(r"^[^/\\:\x00-\x1f\x7f]+$")


def safe_original_name(filename: str | None) -> tuple[str, str]:
    name = (filename or "").strip()
    if not name or name in {".", ".."} or not SAFE_NAME.fullmatch(name) or ".." in name:
        raise HTTPException(status_code=400, detail="The filename is invalid or contains path characters")
    suffix = Path(name).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Unsupported package extension. Use APK, AAB, IPA, or ZIP")
    if len(name) > 255 or name.endswith((".", " ")):
        raise HTTPException(status_code=400, detail="Filename is too long or malformed")
    return name, suffix


def _private_directory(path: Path) -> Path:
    resolved = path.resolve()
    resolved.mkdir(parents=True, exist_ok=True, mode=0o700)
    try:
        resolved.chmod(0o700)
    except OSError:
        pass
    return resolved


def _validate_archive(path: Path, suffix: str) -> None:
    try:
        with zipfile.ZipFile(path) as archive:
            entries = archive.infolist()
            if not entries:
                raise ValueError("empty archive")
            if len(entries) > MAX_ARCHIVE_ENTRIES:
                raise ValueError("too many entries")
            total_uncompressed = 0
            total_compressed = 0
            names: set[str] = set()
            for entry in entries:
                name = entry.filename.replace("\\", "/")
                path_parts = name.split("/")
                mode = entry.external_attr >> 16
                if name.startswith("/") or (path_parts and ":" in path_parts[0]) or ".." in path_parts:
                    raise ValueError("unsafe archive entry")
                if stat.S_ISLNK(mode):
                    raise ValueError("symbolic link entry")
                if name in names:
                    raise ValueError("duplicate archive entry")
                names.add(name)
                total_uncompressed += entry.file_size
                total_compressed += entry.compress_size
                if total_uncompressed > MAX_ARCHIVE_UNCOMPRESSED_BYTES:
                    raise ValueError("archive expansion limit exceeded")
            if total_uncompressed and (total_compressed == 0 or total_uncompressed / total_compressed > MAX_COMPRESSION_RATIO):
                raise ValueError("archive compression ratio limit exceeded")
            if suffix == ".apk" and "AndroidManifest.xml" not in names:
                raise ValueError("APK manifest is missing")
            if suffix == ".aab" and not any(name.endswith("/manifest/AndroidManifest.xml") for name in names):
                raise ValueError("AAB base manifest is missing")
            if suffix == ".ipa" and not any(name.startswith("Payload/") and ".app/Info.plist" in name for name in names):
                raise ValueError("IPA application bundle metadata is missing")
    except (zipfile.BadZipFile, OSError, ValueError) as exc:
        raise HTTPException(status_code=415, detail="File contents are not a valid supported package") from exc


async def stage_upload(upload: UploadFile, platform: str) -> dict:
    original_name, suffix = safe_original_name(upload.filename)
    if (platform == "Android" and suffix == ".ipa") or (platform == "iOS" and suffix in {".apk", ".aab"}):
        raise HTTPException(status_code=415, detail="Package extension does not match the application's platform")
    if (upload.content_type or "").lower() not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported declared content type")

    settings = get_settings()
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    temp_directory = _private_directory(settings.temp_upload_directory)
    staged_path = temp_directory / f"{uuid4().hex}.upload"
    size = 0
    digest = hashlib.sha256()
    first_bytes = b""
    try:
        descriptor = os.open(staged_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "wb") as output:
            while chunk := await upload.read(1024 * 1024):
                size += len(chunk)
                if size > max_bytes:
                    raise HTTPException(status_code=413, detail=f"Upload exceeds the {settings.max_upload_size_mb} MB limit")
                if len(first_bytes) < 8:
                    first_bytes += chunk[: 8 - len(first_bytes)]
                digest.update(chunk)
                output.write(chunk)
        if size == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")
        if not first_bytes.startswith(ZIP_SIGNATURES):
            raise HTTPException(status_code=415, detail="File contents do not match a supported package container")
        _validate_archive(staged_path, suffix)
        return {
            "file_name": original_name,
            "stored_file_name": f"{uuid4().hex}{suffix}",
            "file_size": size,
            "file_hash": digest.hexdigest(),
            "file_type": suffix[1:].upper(),
            "staged_path": os.fspath(staged_path),
        }
    except Exception:
        staged_path.unlink(missing_ok=True)
        raise
    finally:
        await upload.close()


def finalize_upload(staged_path: str, application_id: str, stored_file_name: str) -> dict:
    settings = get_settings()
    root = _private_directory(settings.upload_directory)
    app_directory = (root / application_id).resolve()
    if app_directory.parent != root:
        raise ValueError("Invalid application storage reference")
    _private_directory(app_directory)
    destination = (app_directory / stored_file_name).resolve()
    if destination.parent != app_directory:
        raise ValueError("Invalid generated storage filename")
    os.replace(staged_path, destination)
    try:
        destination.chmod(0o600)
    except OSError:
        pass
    return {"storage_path": os.fspath(destination)}


def cleanup_upload(path: str | None) -> None:
    if path:
        target = Path(path)
        target.unlink(missing_ok=True)
        upload_root = get_settings().upload_directory.resolve()
        parent = target.parent.resolve()
        if parent.parent == upload_root:
            try:
                parent.rmdir()
            except OSError:
                pass


def cleanup_staging_directory() -> None:
    settings = get_settings()
    temp_directory = settings.temp_upload_directory.resolve()
    upload_directory = settings.upload_directory.resolve()
    if temp_directory == upload_directory or upload_directory in temp_directory.parents:
        raise ValueError("Temporary upload directory must not be inside permanent storage")
    _private_directory(temp_directory)
    cutoff = time.time() - 24 * 60 * 60
    for staged_file in temp_directory.glob("*.upload"):
        try:
            if staged_file.stat().st_mtime < cutoff:
                staged_file.unlink(missing_ok=True)
        except FileNotFoundError:
            continue
