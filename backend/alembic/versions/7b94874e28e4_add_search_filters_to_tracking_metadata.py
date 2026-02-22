"""add_search_filters_to_tracking_metadata

Revision ID: 7b94874e28e4
Revises: b5a9ae9dc438
Create Date: 2026-02-03 21:40:26.561023

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7b94874e28e4'
down_revision: Union[str, None] = 'b5a9ae9dc438'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add search_filters column to tracking_metadata table
    op.add_column('tracking_metadata', sa.Column('search_filters', sa.JSON(), nullable=True))


def downgrade() -> None:
    # Remove search_filters column from tracking_metadata table
    op.drop_column('tracking_metadata', 'search_filters')
