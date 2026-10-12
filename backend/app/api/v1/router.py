import logging
from typing import Literal
from uuid import UUID
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db, owned_application, require_admin
from app.db.models import Application, ApplicationVersion, Finding, FindingEvidence, Report, Scan, User
from app.schemas import (ApplicationCreate, ApplicationOut, ApplicationUpdate, DashboardSummary, FindingEvidenceOut, FindingOut, FindingUpdate,
                         RefreshRequest, ReportCreate, ReportOut, ScanCreate, ScanOut, TokenPair, UserLogin, UserOut,
                         UserRegister, UserUpdate, VersionOut)
from app.services import application_service, auth_service, finding_service, report_service, scan_service
from app.storage.file_storage import cleanup_upload, finalize_upload, stage_upload

logger = logging.getLogger("mast.audit")
router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok", "service": "MAST Backend"}


@router.get("/health/database")
def database_health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        logger.warning("database_health_failed", extra={"event": "database_health_failed"})
        raise HTTPException(status_code=503, detail="Database unavailable") from exc
    return {"status": "ok", "service": "MAST Database"}


@router.post("/auth/register", response_model=TokenPair, status_code=201)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    user = auth_service.register(db, email=payload.email, username=payload.username, password=payload.password, full_name=payload.full_name)
    logger.info("user_registered", extra={"event": "user_registered", "user_id": user.id})
    return auth_service.token_pair(user)


@router.post("/auth/login", response_model=TokenPair)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    try:
        user = auth_service.authenticate(db, payload.username, payload.password)
    except HTTPException as exc:
        if exc.status_code == 401:
            logger.warning("authentication_failed", extra={"event": "authentication_failed"})
        raise
    logger.info("authentication_succeeded", extra={"event": "authentication_succeeded", "user_id": user.id})
    return auth_service.token_pair(user)


@router.post("/auth/refresh", response_model=TokenPair)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    return auth_service.rotate_refresh(db, payload.refresh_token)


@router.get("/auth/me", response_model=UserOut)
def auth_me(user: User = Depends(get_current_user)):
    return user


@router.post("/auth/logout", status_code=204)
def logout(payload: RefreshRequest, db: Session = Depends(get_db)):
    auth_service.revoke_token(db, payload.refresh_token)
    return None


@router.get("/users/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    return user


@router.patch("/users/me", response_model=UserOut)
def update_me(payload: UserUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    for key, value in payload.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(user, key, value.strip() if isinstance(value, str) else value)
    db.commit()
    db.refresh(user)
    return user


@router.get("/users", response_model=list[UserOut])
def list_users(limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0), db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return db.query(User).order_by(User.created_at.desc()).limit(limit).offset(offset).all()


@router.get("/users/{user_id}", response_model=UserOut)
def get_user(user_id: UUID, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    user = db.get(User, str(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/applications", response_model=dict)
def list_applications(limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    items, total = application_service.list_owned(db, user.id, limit, offset)
    return {"items": [ApplicationOut.model_validate(item).model_dump(mode="json") for item in items], "total": total, "limit": limit, "offset": offset}


@router.post("/applications", response_model=ApplicationOut, status_code=201)
def create_application(payload: ApplicationCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    application = Application(owner_id=user.id, **payload.model_dump())
    db.add(application)
    db.commit()
    db.refresh(application)
    logger.info("application_created", extra={"event": "application_created", "user_id": user.id, "application_id": application.id})
    return application


@router.get("/applications/{application_id}", response_model=ApplicationOut)
def get_application(application_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    application = application_service.get_owned(db, user.id, str(application_id))
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    return application


@router.patch("/applications/{application_id}", response_model=ApplicationOut)
def update_application(application_id: UUID, payload: ApplicationUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    application = owned_application(str(application_id), user, db)
    for key, value in payload.model_dump(exclude_unset=True).items():
        if value is not None or key == "description":
            setattr(application, key, value)
    db.commit()
    db.refresh(application)
    return application


@router.delete("/applications/{application_id}", status_code=204)
def delete_application(application_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    application = owned_application(str(application_id), user, db)
    if application.versions or db.query(Scan.id).filter(Scan.application_id == application.id).first():
        raise HTTPException(status_code=409, detail="Application has retained versions or scans and cannot be deleted")
    db.delete(application)
    db.commit()
    return None


@router.post("/applications/{application_id}/versions", response_model=VersionOut, status_code=201)
async def upload_version(application_id: UUID, file: UploadFile = File(...), version_name: str | None = Form(default=None, max_length=120), version_code: str | None = Form(default=None, max_length=64), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    application = owned_application(str(application_id), user, db)
    logger.info("upload_started", extra={"event": "upload_started", "user_id": user.id, "application_id": application.id})
    staged_path = None
    storage_path = None
    try:
        staged = await stage_upload(file, application.platform)
        staged_path = staged.pop("staged_path")
        duplicate = db.query(ApplicationVersion).filter(
            ApplicationVersion.application_id == application.id,
            ApplicationVersion.file_hash == staged["file_hash"],
        ).first()
        if duplicate:
            raise HTTPException(status_code=409, detail="This package version has already been uploaded to this application")
        finalized = finalize_upload(staged_path, application.id, staged["stored_file_name"])
        staged_path = None
        storage_path = finalized["storage_path"]
        version = ApplicationVersion(
            application_id=application.id,
            version_name=version_name,
            version_code=version_code,
            upload_status="completed",
            storage_path=storage_path,
            **staged,
        )
        db.add(version)
        db.commit()
        db.refresh(version)
    except HTTPException as exc:
        cleanup_upload(staged_path)
        cleanup_upload(storage_path)
        db.rollback()
        logger.warning("upload_rejected", extra={"event": "upload_rejected", "user_id": user.id, "application_id": application.id, "status_code": exc.status_code})
        raise
    except IntegrityError as exc:
        cleanup_upload(staged_path)
        cleanup_upload(storage_path)
        db.rollback()
        duplicate = db.query(ApplicationVersion.id).filter(
            ApplicationVersion.application_id == application.id,
            ApplicationVersion.file_hash == (staged or {}).get("file_hash"),
        ).first()
        if duplicate:
            logger.warning("upload_rejected", extra={"event": "upload_rejected", "user_id": user.id, "application_id": application.id, "status_code": 409})
            raise HTTPException(status_code=409, detail="This package version has already been uploaded to this application") from exc
        logger.error("upload_failed", extra={"event": "upload_failed", "user_id": user.id, "application_id": application.id, "error_type": type(exc).__name__})
        raise HTTPException(status_code=500, detail="The package could not be stored. Please retry the upload.") from exc
    except Exception as exc:
        cleanup_upload(staged_path)
        cleanup_upload(storage_path)
        db.rollback()
        logger.error("upload_failed", extra={"event": "upload_failed", "user_id": user.id, "application_id": application.id, "error_type": type(exc).__name__})
        raise HTTPException(status_code=500, detail="The package could not be stored. Please retry the upload.") from exc
    logger.info("upload_completed", extra={"event": "upload_completed", "user_id": user.id, "application_id": application.id, "version_id": version.id})
    return version


@router.get("/applications/{application_id}/versions", response_model=list[VersionOut])
def list_versions(application_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    application_id_text = str(application_id)
    owned_application(application_id_text, user, db)
    return db.query(ApplicationVersion).filter(ApplicationVersion.application_id == application_id_text).order_by(ApplicationVersion.created_at.desc()).all()


@router.get("/scans", response_model=dict)
def list_scans(limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0), application_id: UUID | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    items, total = scan_service.list_owned(db, user.id, limit, offset, str(application_id) if application_id else None)
    return {"items": [ScanOut.model_validate(item).model_dump(mode="json") for item in items], "total": total, "limit": limit, "offset": offset}


@router.post("/scans", response_model=ScanOut, status_code=201)
def create_scan(payload: ScanCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    application = owned_application(str(payload.application_id), user, db)
    scan = scan_service.create_queued(db, application_id=application.id, version_id=str(payload.application_version_id), requested_by=user.id)
    logger.info("scan_queued", extra={"event": "scan_queued", "user_id": user.id, "scan_id": scan.id})
    return scan


@router.get("/scans/{scan_id}", response_model=ScanOut)
def get_scan(scan_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    scan = scan_service.get_owned(db, user.id, str(scan_id))
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    return scan


@router.post("/scans/{scan_id}/cancel", response_model=ScanOut)
def cancel_scan(scan_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    scan = scan_service.get_owned(db, user.id, str(scan_id))
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    scan = scan_service.cancel_queued(db, scan)
    logger.info("scan_cancelled", extra={"event": "scan_cancelled", "user_id": user.id, "scan_id": scan.id})
    return scan


@router.get("/findings", response_model=dict)
def list_findings(severity: Literal["Critical", "High", "Medium", "Low", "Info"] | None = None, status: str | None = Query(default=None, min_length=1, max_length=32), application_id: UUID | None = None, scan_id: UUID | None = None, category: str | None = Query(default=None, max_length=80), limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    query = finding_service.query_owned(db, user.id)
    for field, value in ((Finding.severity, severity), (Finding.status, status), (Finding.application_id, str(application_id) if application_id else None), (Finding.scan_id, str(scan_id) if scan_id else None), (Finding.category, category)):
        if value:
            query = query.filter(field == value)
    total = query.count()
    items = query.order_by(Finding.created_at.desc()).limit(limit).offset(offset).all()
    return {"items": [FindingOut.model_validate(item).model_dump(mode="json") for item in items], "total": total, "limit": limit, "offset": offset}


@router.get("/findings/{finding_id}", response_model=FindingOut)
def get_finding(finding_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    finding = finding_service.get_owned(db, user.id, str(finding_id))
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")
    return finding


@router.get("/findings/{finding_id}/evidence", response_model=list[FindingEvidenceOut])
def list_finding_evidence(finding_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    finding = finding_service.get_owned(db, user.id, str(finding_id))
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")
    records = db.query(FindingEvidence).filter(FindingEvidence.finding_id == finding.id).order_by(FindingEvidence.created_at.asc()).all()
    return records


@router.patch("/findings/{finding_id}", response_model=FindingOut)
def update_finding(finding_id: UUID, payload: FindingUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    finding = finding_service.get_owned(db, user.id, str(finding_id))
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")
    finding.status = payload.status.strip()
    db.commit()
    db.refresh(finding)
    return finding


@router.get("/reports", response_model=dict)
def list_reports(limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    query = report_service.query_owned(db, user.id)
    total = query.count()
    items = query.order_by(Report.created_at.desc()).limit(limit).offset(offset).all()
    return {"items": [ReportOut.model_validate(item).model_dump(mode="json") for item in items], "total": total, "limit": limit, "offset": offset}


@router.post("/reports", response_model=ReportOut, status_code=202)
def create_report(payload: ReportCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    scan = db.query(Scan).join(Application).filter(Scan.id == str(payload.scan_id), Application.owner_id == user.id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    report = Report(scan_id=scan.id, generated_by=user.id, report_type=payload.report_type.lower(), status="not_implemented")
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@router.get("/reports/{report_id}", response_model=ReportOut)
def get_report(report_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    report = report_service.get_owned(db, user.id, str(report_id))
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.get("/dashboard/summary", response_model=DashboardSummary)
def dashboard_summary(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    app_ids = select(Application.id).where(Application.owner_id == user.id)
    severity_counts = db.query(Finding.severity, func.count(Finding.id)).filter(Finding.application_id.in_(app_ids)).group_by(Finding.severity).all()
    counts = {key: 0 for key in ("critical", "high", "medium", "low", "info")}
    counts.update({str(severity).lower(): total for severity, total in severity_counts if str(severity).lower() in counts})
    recent_scans = db.query(Scan).filter(Scan.application_id.in_(app_ids)).order_by(Scan.created_at.desc()).limit(5).all()
    recent_findings = db.query(Finding).filter(Finding.application_id.in_(app_ids)).order_by(Finding.created_at.desc()).limit(5).all()
    return DashboardSummary(applications=db.query(Application).filter(Application.owner_id == user.id).count(), scans=db.query(Scan).filter(Scan.application_id.in_(app_ids)).count(), findings=counts, recent_scans=recent_scans, recent_findings=recent_findings)
