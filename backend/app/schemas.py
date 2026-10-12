import re
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

class UserRegister(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=40, pattern=r"^[a-zA-Z0-9_.-]+$")
    password: str = Field(min_length=12, max_length=128)
    full_name: str = Field(min_length=1, max_length=120)

    @field_validator("password")
    @classmethod
    def password_complexity(cls, value: str) -> str:
        if not (re.search(r"[a-z]", value) and re.search(r"[A-Z]", value) and re.search(r"\d", value)):
            raise ValueError("Password must include lowercase, uppercase, and numeric characters")
        return value


class UserLogin(BaseModel):
    username: str = Field(min_length=1, max_length=320)  # Email address or username
    password: str = Field(min_length=1, max_length=128)


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=120)


class UserOut(BaseModel):
    id: str
    email: EmailStr
    username: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


class RefreshRequest(BaseModel):
    refresh_token: str


class ApplicationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    package_name: str = Field(min_length=1, max_length=255, pattern=r"^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$")
    platform: Literal["Android", "iOS"]
    description: str | None = Field(default=None, max_length=4000)

    @field_validator("name", "package_name", mode="before")
    @classmethod
    def trim_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank")
        return value


class ApplicationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    package_name: str | None = Field(default=None, min_length=1, max_length=255, pattern=r"^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$")
    platform: Literal["Android", "iOS"] | None = None
    description: str | None = Field(default=None, max_length=4000)

    @field_validator("name", "package_name", mode="before")
    @classmethod
    def trim_optional_text(cls, value: str | None) -> str | None:
        value = value.strip() if value is not None else None
        if value == "":
            raise ValueError("This field cannot be blank")
        return value


class VersionOut(BaseModel):
    id: str
    application_id: str
    version_name: str | None
    version_code: str | None
    original_filename: str = Field(validation_alias="file_name")
    file_size: int
    file_hash: str
    file_type: Literal["APK", "AAB", "IPA", "ZIP"]
    upload_status: Literal["pending", "uploading", "processing", "completed", "failed", "rejected"]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ApplicationOut(BaseModel):
    id: str
    owner_id: str
    name: str
    package_name: str
    platform: str
    description: str | None
    status: str
    created_at: datetime
    updated_at: datetime
    versions: list[VersionOut] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)


class ScanCreate(BaseModel):
    application_id: UUID
    application_version_id: UUID


class ScanOut(BaseModel):
    id: str
    application_id: str
    application_version_id: str
    requested_by: str
    status: str
    score: int | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    application_name: str
    platform: str
    model_config = ConfigDict(from_attributes=True)


class FindingUpdate(BaseModel):
    status: str = Field(min_length=1, max_length=32)


class FindingOut(BaseModel):
    id: str
    scan_id: str
    application_id: str
    title: str
    severity: str
    category: str
    description: str
    status: str
    location: str | None
    recommendation: str | None
    created_at: datetime
    updated_at: datetime
    application_name: str
    model_config = ConfigDict(from_attributes=True)


class FindingEvidenceOut(BaseModel):
    id: str
    finding_id: str
    evidence_type: str
    title: str
    description: str | None
    line_number: int | None
    metadata: dict = Field(validation_alias="metadata_json")
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ReportCreate(BaseModel):
    scan_id: UUID
    report_type: Literal["PDF", "HTML", "JSON"] = "JSON"


class ReportOut(BaseModel):
    id: str
    scan_id: str
    generated_by: str
    report_type: str
    status: str
    created_at: datetime
    completed_at: datetime | None
    model_config = ConfigDict(from_attributes=True)


class DashboardSummary(BaseModel):
    applications: int
    scans: int
    findings: dict[str, int]
    recent_scans: list[ScanOut]
    recent_findings: list[FindingOut]
