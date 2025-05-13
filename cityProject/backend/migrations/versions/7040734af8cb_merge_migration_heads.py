"""merge migration heads

Revision ID: 7040734af8cb
Revises: 4896d5fc8574, ad2942e98743, a84b5d63c72e
Create Date: 2025-05-09 15:30:55.367040

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '7040734af8cb'
down_revision = ('4896d5fc8574', 'ad2942e98743', 'a84b5d63c72e')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass