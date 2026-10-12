from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "MAST Backend"
    app_env: str = "development"
    database_url: str = "sqlite:///./mast.db"
    jwt_secret_key: str = "local-development-only-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    max_upload_size_mb: int = 500
    upload_directory: Path = Path("./var/uploads")
    temp_upload_directory: Path = Path("./var/tmp/uploads")
    allowed_upload_extensions: Annotated[list[str], NoDecode] = ["apk", "aab", "ipa", "zip"]
    report_directory: Path = Path("./var/reports")
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    log_level: str = "INFO"
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @field_validator("max_upload_size_mb")
    @classmethod
    def positive_upload_limit(cls, value: int) -> int:
        if value < 1 or value > 2048:
            raise ValueError("MAX_UPLOAD_SIZE_MB must be between 1 and 2048")
        return value

    @field_validator("jwt_algorithm")
    @classmethod
    def supported_jwt_algorithm(cls, value: str) -> str:
        if value not in {"HS256", "HS384", "HS512"}:
            raise ValueError("JWT_ALGORITHM must be HS256, HS384, or HS512")
        return value

    @field_validator("access_token_expire_minutes")
    @classmethod
    def valid_access_token_lifetime(cls, value: int) -> int:
        if value < 1 or value > 1440:
            raise ValueError("ACCESS_TOKEN_EXPIRE_MINUTES must be between 1 and 1440")
        return value

    @field_validator("refresh_token_expire_days")
    @classmethod
    def valid_refresh_token_lifetime(cls, value: int) -> int:
        if value < 1 or value > 90:
            raise ValueError("REFRESH_TOKEN_EXPIRE_DAYS must be between 1 and 90")
        return value

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("allowed_upload_extensions", mode="before")
    @classmethod
    def parse_upload_extensions(cls, value: object) -> object:
        if isinstance(value, str):
            return [extension.strip().lower().lstrip(".") for extension in value.split(",") if extension.strip()]
        return value

    @field_validator("allowed_upload_extensions")
    @classmethod
    def validate_upload_extensions(cls, value: list[str]) -> list[str]:
        allowed = {"apk", "aab", "ipa", "zip"}
        normalized = list(dict.fromkeys(extension.lower().lstrip(".") for extension in value))
        if not normalized or not set(normalized) <= allowed:
            raise ValueError("ALLOWED_UPLOAD_EXTENSIONS must contain only apk,aab,ipa,zip")
        return normalized

    @property
    def production(self) -> bool:
        return self.app_env.lower() == "production"

    @model_validator(mode="after")
    def safe_production_settings(self):
        if self.production and (len(self.jwt_secret_key) < 32 or self.jwt_secret_key == "local-development-only-change-me" or self.jwt_secret_key.startswith("replace-with-")):
            raise ValueError("Production requires a randomly generated JWT_SECRET_KEY of at least 32 characters")
        if self.production and "*" in self.cors_origins:
            raise ValueError("Production CORS_ORIGINS must not contain a wildcard")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
