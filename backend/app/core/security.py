from datetime import datetime, timedelta, timezone
from uuid import uuid4

import jwt
from pwdlib import PasswordHash

from app.core.config import get_settings

password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return password_hash.verify(password, hashed)


def create_token(user_id: str, token_type: str, lifetime: timedelta, token_version: int = 0) -> tuple[str, str, datetime]:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    expires = now + lifetime
    jti = str(uuid4())
    token = jwt.encode({"sub": user_id, "type": token_type, "jti": jti, "ver": token_version, "iat": now, "exp": expires}, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return token, jti, expires


def decode_token(token: str, expected_type: str) -> dict:
    settings = get_settings()
    payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    if payload.get("type") != expected_type or not payload.get("sub") or not payload.get("jti"):
        raise jwt.InvalidTokenError("Invalid token claims")
    return payload
