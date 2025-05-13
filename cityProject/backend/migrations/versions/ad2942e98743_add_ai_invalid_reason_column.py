"""add_ai_invalid_reason_column

Revision ID: ad2942e98743
Revises: fb3fd1f69939
Create Date: 2025-05-06 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ad2942e98743'
down_revision: Union[str, None] = 'ac16b88503fd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add the invalid_reason column to the report table
    op.add_column('report', sa.Column('ai_invalid_reason', sa.Text(), nullable=True))


def downgrade() -> None:
    # Drop the invalid_reason column
    op.drop_column('report', 'ai_invalid_reason')