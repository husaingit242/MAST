from sqlalchemy.orm import Session, joinedload

from app.db.models import Application, ApplicationVersion


def list_owned(db: Session, owner_id: str, limit: int, offset: int):
    query = db.query(Application).options(joinedload(Application.versions)).filter(Application.owner_id == owner_id)
    total = query.count()
    items = query.order_by(Application.created_at.desc()).limit(limit).offset(offset).all()
    return items, total


def get_owned(db: Session, owner_id: str, application_id: str) -> Application | None:
    return db.query(Application).options(joinedload(Application.versions)).filter(Application.id == application_id, Application.owner_id == owner_id).first()


def latest_version(db: Session, application_id: str) -> ApplicationVersion | None:
    return db.query(ApplicationVersion).filter(ApplicationVersion.application_id == application_id).order_by(ApplicationVersion.created_at.desc()).first()
