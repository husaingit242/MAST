import sys
import secrets
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.models import Application, ApplicationVersion, Finding, Report, RevokedToken, Scan, ScanJob, User, FindingEvidence  # noqa: E402,F401
from app.db.session import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture
def client(tmp_path, monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    app.state.test_session_factory = TestingSession
    Base.metadata.create_all(engine)
    def override_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()
    app.dependency_overrides[get_db] = override_db
    from app.core.config import get_settings
    settings = get_settings()
    monkeypatch.setattr(settings, "upload_directory", tmp_path / "private_uploads")
    monkeypatch.setattr(settings, "temp_upload_directory", tmp_path / "private_temp_uploads")
    monkeypatch.setattr(settings, "report_directory", tmp_path / "private_reports")
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture
def register(client):
    def create(username="analyst", email=None):
        password = secrets.token_urlsafe(18) + "aA1!"
        response = client.post("/api/v1/auth/register", json={
            "email": email or f"{username}@example.com", "username": username,
            "password": password, "full_name": "Test Analyst",
        })
        assert response.status_code == 201, response.text
        result = response.json()
        result["test_password"] = password
        return result
    return create
