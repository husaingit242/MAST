from datetime import timedelta
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import or_, update
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import create_token, hash_password, verify_password
from app.db.models import RevokedToken, User, now_utc


def register(db: Session, *, email: str, username: str, password: str, full_name: str) -> User:
    if db.query(User).filter(or_(User.email == email.lower(), User.username == username)).first():
        raise HTTPException(status_code=409, detail="Email or username is already registered")
    user = User(email=email.lower(), username=username, password_hash=hash_password(password), full_name=full_name.strip(), role="analyst")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate(db: Session, username: str, password: str) -> User:
    user = db.query(User).filter(or_(User.email == username.lower(), User.username == username)).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password", headers={"WWW-Authenticate": "Bearer"})
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is inactive")
    user.last_login_at = now_utc()
    db.commit()
    return user


def token_pair(user: User) -> dict:
    settings = get_settings()
    access, _, _ = create_token(user.id, "access", timedelta(minutes=settings.access_token_expire_minutes), user.token_version)
    refresh, _, _ = create_token(user.id, "refresh", timedelta(days=settings.refresh_token_expire_days), user.token_version)
    return {"access_token": access, "refresh_token": refresh, "token_type": "bearer", "user": user}


def rotate_refresh(db: Session, token: str) -> dict:
    import jwt
    from app.core.security import decode_token
    try:
        payload = decode_token(token, "refresh")
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token") from exc
    if db.get(RevokedToken, payload["jti"]):
        raise HTTPException(status_code=401, detail="Refresh token has been revoked")
    user = db.get(User, payload["sub"])
    if not user or not user.is_active or payload.get("ver") != user.token_version:
        raise HTTPException(status_code=401, detail="User is unavailable")
    result = db.execute(update(User).where(User.id == user.id, User.token_version == payload.get("ver")).values(token_version=User.token_version + 1))
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(status_code=401, detail="Refresh token has already been used")
    db.refresh(user)
    expires_at = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    db.add(RevokedToken(jti=payload["jti"], expires_at=expires_at))
    result = token_pair(user)
    # Revoke the replaced refresh token only after successfully generating its replacement.
    db.commit()
    return result


def revoke_token(db: Session, token: str) -> None:
    import jwt
    from app.core.security import decode_token
    try:
        payload = decode_token(token, "refresh")
    except jwt.InvalidTokenError:
        return
    user = db.get(User, payload["sub"])
    if user and payload.get("ver") == user.token_version and not db.get(RevokedToken, payload["jti"]):
        expires_at = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        db.add(RevokedToken(jti=payload["jti"], expires_at=expires_at))
        user.token_version += 1
        db.commit()
