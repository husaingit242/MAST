from fastapi import HTTPException
import logging
from sqlalchemy.orm import Session

from app.db.models import Application, ApplicationVersion, Scan, ScanJob

audit = logging.getLogger("mast.audit")


def list_owned(db: Session, owner_id: str, limit: int, offset: int, application_id: str | None = None):
    query = db.query(Scan).join(Application, Scan.application_id == Application.id).filter(Application.owner_id == owner_id)
    if application_id:
        query = query.filter(Scan.application_id == application_id)
    total = query.count()
    return query.order_by(Scan.created_at.desc()).limit(limit).offset(offset).all(), total


def get_owned(db: Session, owner_id: str, scan_id: str) -> Scan | None:
    scan = db.query(Scan).join(Application).filter(Scan.id == scan_id, Application.owner_id == owner_id).first()
    if not scan:
        audit.warning("resource_access_denied", extra={"event": "resource_access_denied", "user_id": owner_id, "resource": "scan", "resource_id": scan_id})
    return scan


def create_queued(db: Session, *, application_id: str, version_id: str, requested_by: str) -> Scan:
    version = db.query(ApplicationVersion).filter(ApplicationVersion.id == version_id, ApplicationVersion.application_id == application_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Application version not found")
    scan = Scan(application_id=application_id, application_version_id=version.id, requested_by=requested_by, status="queued", score=None)
    db.add(scan)
    db.flush()
    db.add(ScanJob(scan_id=scan.id, status="queued", job_type="analysis_pending"))
    db.commit()
    db.refresh(scan)
    return scan


def cancel_queued(db: Session, scan: Scan) -> Scan:
    if scan.status != "queued":
        raise HTTPException(status_code=409, detail="Only queued scans can be cancelled")
    scan.status = "cancelled"
    if scan.job:
        scan.job.status = "cancelled"
    db.commit()
    db.refresh(scan)
    return scan
