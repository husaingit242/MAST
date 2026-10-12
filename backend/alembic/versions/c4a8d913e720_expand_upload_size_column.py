"""allow configured uploads above the signed 32-bit integer limit

Revision ID: c4a8d913e720
Revises: b9e21a6f4d30
Create Date: 2026-09-26
"""
from alembic import op
import sqlalchemy as sa


revision = "c4a8d913e720"
down_revision = "b9e21a6f4d30"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("application_versions") as batch_op:
        batch_op.alter_column(
            "file_size",
            existing_type=sa.Integer(),
            type_=sa.BigInteger(),
            existing_nullable=False,
        )
    op.execute("UPDATE application_versions SET file_type = UPPER(file_type)")


def downgrade() -> None:
    with op.batch_alter_table("application_versions") as batch_op:
        batch_op.alter_column(
            "file_size",
            existing_type=sa.BigInteger(),
            type_=sa.Integer(),
            existing_nullable=False,
        )
