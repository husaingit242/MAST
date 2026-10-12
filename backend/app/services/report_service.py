import logging

from sqlalchemy.orm import Session

from app.db.models import Application, Report, Scan

audit = logging.getLogger("mast.audit")


def query_owned(db: Session, owner_id: str):
    return db.query(Report).join(Scan, Report.scan_id == Scan.id).join(Application, Scan.application_id == Application.id).filter(Application.owner_id == owner_id)


def get_owned(db: Session, owner_id: str, report_id: str) -> Report | None:
    report = query_owned(db, owner_id).filter(Report.id == report_id).first()
    if not report:
        audit.warning("resource_access_denied", extra={"event": "resource_access_denied", "user_id": owner_id, "resource": "report", "resource_id": report_id})
    return report
