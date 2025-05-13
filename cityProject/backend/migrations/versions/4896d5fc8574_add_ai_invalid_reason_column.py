"""add_ai_invalid_reason_column

Revision ID: 4896d5fc8574
Revises: fb3fd1f69939
Create Date: 2025-05-06 19:24:55.970817

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '4896d5fc8574'
down_revision = 'fb3fd1f69939'
branch_labels = None
depends_on = None


def upgrade():
    # Add ai_invalid_reason column to report table
    op.add_column('report', sa.Column('ai_invalid_reason', sa.Text(), nullable=True))


def downgrade():
    # Drop ai_invalid_reason column from report table
    op.drop_column('report', 'ai_invalid_reason')