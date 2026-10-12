import logging

from sqlalchemy.orm import Session

from app.db.models import Application, Finding

audit = logging.getLogger("mast.audit")


def query_owned(db: Session, owner_id: str):
    return db.query(Finding).join(Application, Finding.application_id == Application.id).filter(Application.owner_id == owner_id)


def get_owned(db: Session, owner_id: str, finding_id: str) -> Finding | None:
    finding = query_owned(db, owner_id).filter(Finding.id == finding_id).first()
    if not finding:
        audit.warning("resource_access_denied", extra={"event": "resource_access_denied", "user_id": owner_id, "resource": "finding", "resource_id": finding_id})
    return finding
