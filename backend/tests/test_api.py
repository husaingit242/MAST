import hashlib
import io
import secrets
import zipfile
import pytest
from pydantic import ValidationError
from app.core.config import get_settings
from app.db.models import ApplicationVersion


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def package_bytes(file_type="zip"):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        if file_type == "apk":
            archive.writestr("AndroidManifest.xml", "benign test fixture")
        elif file_type == "aab":
            archive.writestr("base/manifest/AndroidManifest.xml", "benign test fixture")
        elif file_type == "ipa":
            archive.writestr("Payload/MAST.app/Info.plist", "benign test fixture")
        else:
            archive.writestr("META-INF/placeholder.txt", "benign test fixture")
    return buffer.getvalue()


def test_auth_registration_login_and_protected_endpoints(client, register):
    assert client.get("/api/v1/auth/me").status_code == 401
    user = register()
    assert user["user"]["role"] == "analyst"
    assert "password_hash" not in user["user"]
    response = client.post("/api/v1/auth/login", json={"username": "analyst", "password": user["test_password"]})
    assert response.status_code == 200
    assert client.get("/api/v1/auth/me", headers=auth(response.json()["access_token"])).status_code == 200
    assert client.get("/api/v1/users/me", headers=auth(response.json()["access_token"])).status_code == 200
    assert client.patch("/api/v1/users/me", headers=auth(response.json()["access_token"]), json={"full_name": "  Updated Analyst  "}).json()["full_name"] == "Updated Analyst"
    assert client.get("/api/v1/users", headers=auth(response.json()["access_token"])).status_code == 403
    assert client.post("/api/v1/auth/login", json={"username": "analyst", "password": secrets.token_urlsafe(18) + "aA1!"}).status_code == 401
    rotated = client.post("/api/v1/auth/refresh", json={"refresh_token": user["refresh_token"]})
    assert rotated.status_code == 200
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": user["refresh_token"]}).status_code == 401
    assert client.post("/api/v1/auth/logout", json={"refresh_token": rotated.json()["refresh_token"]}).status_code == 204
    assert client.get("/api/v1/auth/me", headers=auth(rotated.json()["access_token"])).status_code == 401


def test_application_crud_and_owner_isolation(client, register):
    first, second = register("analyst"), register("other", "other@example.com")
    headers = auth(first["access_token"])
    payload = {"name": "Demo App", "package_name": "org.example.demo", "platform": "Android"}
    created = client.post("/api/v1/applications", json=payload, headers=headers)
    assert created.status_code == 201, created.text
    application_id = created.json()["id"]
    assert client.get("/api/v1/applications", headers=headers).json()["total"] == 1
    assert client.post("/api/v1/applications", json={"name": "   ", "package_name": "org.example.blank", "platform": "Android"}, headers=headers).status_code == 422
    assert client.get(f"/api/v1/applications/{application_id}", headers=headers).status_code == 200
    assert client.get(f"/api/v1/applications/{application_id}", headers=auth(second["access_token"])).status_code == 404
    assert client.patch(f"/api/v1/applications/{application_id}", json={"name": "Updated"}, headers=headers).json()["name"] == "Updated"
    assert client.delete(f"/api/v1/applications/{application_id}", headers=headers).status_code == 204


def test_upload_validation_hash_and_secure_generated_name(client, register):
    user = register()
    headers = auth(user["access_token"])
    app = client.post("/api/v1/applications", json={"name": "Demo", "package_name": "org.example.demo", "platform": "Android"}, headers=headers).json()
    contents = package_bytes("apk")
    uploaded = client.post(f"/api/v1/applications/{app['id']}/versions", headers=headers, files={"file": ("safe.apk", contents, "application/vnd.android.package-archive")})
    assert uploaded.status_code == 201, uploaded.text
    version = uploaded.json()
    assert version["file_hash"] == hashlib.sha256(contents).hexdigest()
    assert version["original_filename"] == "safe.apk"
    assert version["file_type"] == "APK"
    assert version["upload_status"] == "completed"
    stored_path = next((get_settings().upload_directory / app["id"]).glob("*.apk"))
    assert stored_path.read_bytes() == contents
    assert list(get_settings().temp_upload_directory.glob("*.upload")) == []
    assert "storage_path" not in version and "stored_file_name" not in version
    assert client.get(f"/api/v1/applications/{app['id']}/versions", headers=headers).json()[0]["id"] == version["id"]
    assert client.get("/api/v1/scans", headers=headers).json()["total"] == 0
    assert client.delete(f"/api/v1/applications/{app['id']}", headers=headers).status_code == 409
    duplicate = client.post(f"/api/v1/applications/{app['id']}/versions", headers=headers, files={"file": ("safe-copy.apk", contents, "application/vnd.android.package-archive")})
    assert duplicate.status_code == 409
    assert len(list((get_settings().upload_directory / app["id"]).glob("*.apk"))) == 1
    assert client.post(f"/api/v1/applications/{app['id']}/versions", headers=headers, files={"file": ("../../unsafe.apk", contents, "application/vnd.android.package-archive")}).status_code == 400
    assert client.post(f"/api/v1/applications/{app['id']}/versions", headers=headers, files={"file": ("file.exe", contents, "application/octet-stream")}).status_code == 415
    assert client.post(f"/api/v1/applications/{app['id']}/versions", headers=headers, files={"file": ("fake.apk", b"not a zip", "application/vnd.android.package-archive")}).status_code == 415
    assert client.post(f"/api/v1/applications/{app['id']}/versions", headers=headers, files={"file": ("fake.apk", contents, "text/plain")}).status_code == 415
    assert client.post(f"/api/v1/applications/{app['id']}/versions", headers=headers, files={"file": ("malformed.apk", package_bytes(), "application/vnd.android.package-archive")}).status_code == 415
    for filename in ("../../evil.apk", r"..\..\evil.apk", "/etc/passwd", r"C:\Windows\system32\evil.apk"):
        rejected = client.post(f"/api/v1/applications/{app['id']}/versions", headers=headers, files={"file": (filename, contents, "application/vnd.android.package-archive")})
        assert rejected.status_code in {400, 409, 415}
    assert client.post(f"/api/v1/applications/{app['id']}/versions", files={"file": ("anonymous.apk", contents, "application/vnd.android.package-archive")}).status_code == 401
    missing_id = "00000000-0000-4000-8000-000000000001"
    assert client.post(f"/api/v1/applications/{missing_id}/versions", headers=headers, files={"file": ("missing.apk", contents, "application/vnd.android.package-archive")}).status_code == 404


@pytest.mark.parametrize(
    ("file_type", "platform", "mime"),
    [
        ("apk", "Android", "application/vnd.android.package-archive"),
        ("aab", "Android", "application/octet-stream"),
        ("ipa", "iOS", "application/x-itunes-ipa"),
        ("zip", "Android", "application/zip"),
    ],
)
def test_supported_package_types_are_classified_and_persisted(client, register, file_type, platform, mime):
    user = register()
    headers = auth(user["access_token"])
    application = client.post("/api/v1/applications", headers=headers, json={
        "name": f"{file_type} app", "package_name": f"org.example.{file_type}", "platform": platform,
    }).json()
    content = package_bytes(file_type)
    response = client.post(
        f"/api/v1/applications/{application['id']}/versions",
        headers=headers,
        files={"file": (f"fixture.{file_type}", content, mime)},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["file_type"] == file_type.upper()
    assert body["upload_status"] == "completed"
    assert body["file_hash"] == hashlib.sha256(content).hexdigest()


def test_empty_package_and_suspicious_zip_entries_are_rejected_without_staging(client, register):
    user = register()
    headers = auth(user["access_token"])
    application = client.post("/api/v1/applications", headers=headers, json={
        "name": "Archive checks", "package_name": "org.example.archivechecks", "platform": "Android",
    }).json()
    empty = client.post(
        f"/api/v1/applications/{application['id']}/versions",
        headers=headers,
        files={"file": ("empty.zip", b"", "application/zip")},
    )
    assert empty.status_code == 400
    traversal_buffer = io.BytesIO()
    with zipfile.ZipFile(traversal_buffer, "w") as archive:
        archive.writestr("../outside.txt", "not extracted")
    traversal = client.post(
        f"/api/v1/applications/{application['id']}/versions",
        headers=headers,
        files={"file": ("traversal.zip", traversal_buffer.getvalue(), "application/zip")},
    )
    assert traversal.status_code == 415
    assert list(get_settings().temp_upload_directory.glob("*.upload")) == []
    assert client.get(f"/api/v1/applications/{application['id']}/versions", headers=headers).json() == []


def test_long_filename_rejected(client, register):
    user = register()
    headers = auth(user["access_token"])
    application = client.post("/api/v1/applications", headers=headers, json={
        "name": "Filename checks", "package_name": "org.example.filenamechecks", "platform": "Android",
    }).json()
    response = client.post(
        f"/api/v1/applications/{application['id']}/versions",
        headers=headers,
        files={"file": (f"{'a' * 252}.zip", package_bytes(), "application/zip")},
    )
    assert response.status_code in {400, 413, 422}


def test_upload_cleans_staging_and_final_file_when_persistence_fails(client, register, monkeypatch):
    user = register()
    headers = auth(user["access_token"])
    application = client.post("/api/v1/applications", headers=headers, json={
        "name": "Cleanup app", "package_name": "org.example.cleanup", "platform": "Android",
    }).json()
    from sqlalchemy.orm import Session
    original_commit = Session.commit

    def fail_version_commit(session):
        if any(isinstance(item, ApplicationVersion) for item in session.new):
            raise RuntimeError("simulated database failure")
        return original_commit(session)

    monkeypatch.setattr(Session, "commit", fail_version_commit)
    response = client.post(
        f"/api/v1/applications/{application['id']}/versions",
        headers=headers,
        files={"file": ("cleanup.apk", package_bytes("apk"), "application/vnd.android.package-archive")},
    )
    assert response.status_code == 500
    settings = __import__("app.core.config", fromlist=["get_settings"]).get_settings()
    assert list(settings.temp_upload_directory.glob("*.upload")) == []
    assert not (settings.upload_directory / application["id"]).exists()


def test_upload_size_limit_and_unauthorized_upload(client, register, monkeypatch):
    owner, other = register(), register("other", "other@example.com")
    owner_headers = auth(owner["access_token"])
    application = client.post("/api/v1/applications", json={"name": "Size Test", "package_name": "org.example.size", "platform": "Android"}, headers=owner_headers).json()
    from app.core.config import get_settings
    monkeypatch.setattr(get_settings(), "max_upload_size_mb", 1)
    large = b"PK\x03\x04" + b"x" * (1024 * 1024 + 1)
    rejected = client.post(f"/api/v1/applications/{application['id']}/versions", headers=owner_headers, files={"file": ("large.apk", large, "application/vnd.android.package-archive")})
    assert rejected.status_code == 413
    assert list(get_settings().temp_upload_directory.glob("*.upload")) == []
    request_too_large = b"PK\x03\x04" + b"x" * (1024 * 1024 + 64 * 1024 + 1)
    rejected_before_spooling = client.post(
        f"/api/v1/applications/{application['id']}/versions",
        headers=owner_headers,
        files={"file": ("request-too-large.apk", request_too_large, "application/vnd.android.package-archive")},
    )
    assert rejected_before_spooling.status_code == 413
    assert list(get_settings().temp_upload_directory.glob("*.upload")) == []
    denied = client.post(f"/api/v1/applications/{application['id']}/versions", headers=auth(other["access_token"]), files={"file": ("other.apk", package_bytes(), "application/vnd.android.package-archive")})
    assert denied.status_code == 404


def test_scan_queue_cancel_and_ownership(client, register):
    first, second = register(), register("other", "other@example.com")
    headers = auth(first["access_token"])
    app = client.post("/api/v1/applications", json={"name": "Demo", "package_name": "org.example.demo", "platform": "Android"}, headers=headers).json()
    content = package_bytes("apk")
    version = client.post(f"/api/v1/applications/{app['id']}/versions", headers=headers, files={"file": ("demo.apk", content, "application/vnd.android.package-archive")}).json()
    scan_response = client.post("/api/v1/scans", headers=headers, json={"application_id": app["id"], "application_version_id": version["id"]})
    assert scan_response.status_code == 201, scan_response.text
    scan = scan_response.json()
    assert scan["status"] == "queued" and scan["score"] is None
    assert client.get("/api/v1/scans", headers=headers).json()["total"] == 1
    assert client.get(f"/api/v1/scans/{scan['id']}", headers=auth(second["access_token"])).status_code == 404
    assert client.post(f"/api/v1/scans/{scan['id']}/cancel", headers=headers).json()["status"] == "cancelled"


def test_invalid_scan_reference_is_rejected(client, register):
    user = register()
    response = client.post("/api/v1/scans", headers=auth(user["access_token"]), json={"application_id": "missing", "application_version_id": "missing"})
    assert response.status_code == 422
    valid_but_missing = client.post("/api/v1/scans", headers=auth(user["access_token"]), json={"application_id": "00000000-0000-4000-8000-000000000001", "application_version_id": "00000000-0000-4000-8000-000000000002"})
    assert valid_but_missing.status_code == 404


def test_findings_dashboard_and_report_foundation_return_no_fake_results(client, register):
    user = register()
    headers = auth(user["access_token"])
    dashboard = client.get("/api/v1/dashboard/summary", headers=headers).json()
    assert dashboard["applications"] == 0 and dashboard["scans"] == 0
    assert dashboard["findings"] == {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    assert dashboard["recent_findings"] == []
    assert client.get("/api/v1/findings", headers=headers).json()["total"] == 0
    assert client.get("/api/v1/findings?severity=untrusted", headers=headers).status_code == 422
    assert client.get("/api/v1/reports", headers=headers).json()["total"] == 0
    assert client.get("/api/v1/health").json()["status"] == "ok"
    assert client.get("/api/v1/health/database").status_code == 200
    assert client.get("/docs").status_code == 200
    assert client.get("/redoc").status_code == 200
    openapi = client.get("/openapi.json")
    assert openapi.status_code == 200
    assert any(value.get("type") == "http" and value.get("scheme") == "bearer" for value in openapi.json()["components"]["securitySchemes"].values())


def test_finding_report_and_dashboard_are_owner_scoped(client, register):
    owner, other = register(), register("other", "other@example.com")
    owner_headers, other_headers = auth(owner["access_token"]), auth(other["access_token"])
    application = client.post("/api/v1/applications", json={"name": "Real record", "package_name": "org.example.real", "platform": "Android"}, headers=owner_headers).json()
    version = client.post(f"/api/v1/applications/{application['id']}/versions", headers=owner_headers, files={"file": ("real.apk", package_bytes("apk"), "application/vnd.android.package-archive")}).json()
    scan = client.post("/api/v1/scans", headers=owner_headers, json={"application_id": application["id"], "application_version_id": version["id"]}).json()
    from app.db.models import Finding, FindingEvidence
    with client.app.state.test_session_factory() as db:
        finding = Finding(scan_id=scan["id"], application_id=application["id"], title="Test fixture finding", severity="High", category="Test", description="Inserted by a test only", status="Open", location="AndroidManifest.xml")
        db.add(finding); db.flush()
        db.add(FindingEvidence(finding_id=finding.id, evidence_type="metadata", title="Test evidence", file_path="/private/internal/path", metadata_json={"source":"test"}))
        db.commit(); db.refresh(finding); finding_id = finding.id
    listed = client.get("/api/v1/findings?severity=High", headers=owner_headers)
    assert listed.status_code == 200 and listed.json()["total"] == 1
    assert listed.json()["items"][0]["application_name"] == "Real record"
    assert "storage_path" not in listed.text
    assert client.get(f"/api/v1/findings/{finding_id}", headers=other_headers).status_code == 404
    evidence = client.get(f"/api/v1/findings/{finding_id}/evidence", headers=owner_headers)
    assert evidence.status_code == 200 and evidence.json()[0]["metadata"] == {"source": "test"}
    assert "file_path" not in evidence.json()[0] and "private/internal/path" not in evidence.text
    updated = client.patch(f"/api/v1/findings/{finding_id}", headers=owner_headers, json={"status": "Confirmed"})
    assert updated.status_code == 200 and updated.json()["status"] == "Confirmed"
    report = client.post("/api/v1/reports", headers=owner_headers, json={"scan_id": scan["id"], "report_type": "JSON"})
    assert report.status_code == 202 and report.json()["status"] == "not_implemented"
    assert client.get(f"/api/v1/reports/{report.json()['id']}", headers=other_headers).status_code == 404
    summary = client.get("/api/v1/dashboard/summary", headers=owner_headers).json()
    assert summary["applications"] == 1 and summary["scans"] == 1 and summary["findings"]["high"] == 1


def test_environment_configuration_parses_cors_and_rejects_unsafe_production_values():
    from app.core.config import Settings
    settings = Settings(_env_file=None, cors_origins="https://console.example.com,http://localhost:5173")
    assert settings.cors_origins == ["https://console.example.com", "http://localhost:5173"]
    upload_settings = Settings(_env_file=None, allowed_upload_extensions="apk,ipa", max_upload_size_mb=1200)
    assert upload_settings.allowed_upload_extensions == ["apk", "ipa"]
    assert upload_settings.max_upload_size_mb == 1200
    with pytest.raises(ValidationError):
        Settings(_env_file=None, allowed_upload_extensions="apk,exe")
    with pytest.raises(ValidationError):
        Settings(_env_file=None, app_env="production", jwt_secret_key="replace-with-a-random-secret-before-any-shared-deployment")
    with pytest.raises(ValidationError):
        Settings(_env_file=None, app_env="production", jwt_secret_key="a" * 64, cors_origins=["*"])
