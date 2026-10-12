import logging

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.models import RevokedToken, User
from app.db.session import get_db

bearer_scheme = HTTPBearer(auto_error=False)
audit = logging.getLogger("mast.audit")


def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme), db: Session = Depends(get_db)) -> User:
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required", headers={"WWW-Authenticate": "Bearer"})
    token = credentials.credentials
    try:
        payload = decode_token(token, "access")
    except jwt.InvalidTokenError as exc:
        audit.warning("authentication_rejected", extra={"event": "authentication_rejected"})
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired access token", headers={"WWW-Authenticate": "Bearer"}) from exc
    if db.get(RevokedToken, payload["jti"]):
        audit.warning("revoked_access_token", extra={"event": "revoked_access_token", "user_id": payload["sub"]})
        raise HTTPException(status_code=401, detail="Access token has been revoked")
    user = db.get(User, payload["sub"])
    if not user or not user.is_active or payload.get("ver") != user.token_version:
        audit.warning("inactive_or_revoked_user_session", extra={"event": "inactive_or_revoked_user_session", "user_id": payload["sub"]})
        raise HTTPException(status_code=401, detail="User is unavailable")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        audit.warning("authorization_denied", extra={"event": "authorization_denied", "user_id": user.id, "required_role": "admin"})
        raise HTTPException(status_code=403, detail="Administrator role required")
    return user


def owned_application(application_id: str, user: User, db: Session):
    from app.db.models import Application
    application = db.query(Application).filter(Application.id == application_id, Application.owner_id == user.id).first()
    if not application:
        audit.warning("resource_access_denied", extra={"event": "resource_access_denied", "user_id": user.id, "resource": "application", "resource_id": application_id})
        raise HTTPException(status_code=404, detail="Application not found")
    return application
