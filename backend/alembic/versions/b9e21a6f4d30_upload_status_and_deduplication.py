"""add upload status and application-scoped content deduplication

Revision ID: b9e21a6f4d30
Revises: 6712ac07aa74
Create Date: 2026-09-26
"""
from alembic import op
import sqlalchemy as sa


revision = "b9e21a6f4d30"
down_revision = "6712ac07aa74"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "application_versions",
        sa.Column("upload_status", sa.String(length=16), nullable=False, server_default="completed"),
    )
    op.create_index("ix_application_versions_upload_status", "application_versions", ["upload_status"], unique=False)
    op.create_index(
        "uq_application_versions_application_hash",
        "application_versions",
        ["application_id", "file_hash"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_application_versions_application_hash", table_name="application_versions")
    op.drop_index("ix_application_versions_upload_status", table_name="application_versions")
    op.drop_column("application_versions", "upload_status")
