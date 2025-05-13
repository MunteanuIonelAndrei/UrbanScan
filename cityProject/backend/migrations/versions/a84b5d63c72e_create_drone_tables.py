"""Create drone AI settings and reports tables

Revision ID: a84b5d63c72e
Revises: fb3fd1f69939
Create Date: 2025-05-09 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'a84b5d63c72e'
down_revision = 'fb3fd1f69939'
branch_labels = None
depends_on = None


def upgrade():
    # Create drone_aisetting table
    op.create_table(
        'droneaisetting',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('key', sa.String(), nullable=False),
        sa.Column('value', sa.Text(), nullable=True),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_droneaisetting_id'), 'droneaisetting', ['id'], unique=False)
    op.create_index(op.f('ix_droneaisetting_key'), 'droneaisetting', ['key'], unique=True)
    
    # Create dronereport table
    op.create_table(
        'dronereport',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('report_id', sa.String(), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('drone_id', sa.String(), nullable=True),
        sa.Column('frame_type', sa.String(), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('altitude', sa.Float(), nullable=True),
        sa.Column('location_description', sa.String(), nullable=True),
        sa.Column('category', sa.String(), nullable=True),
        sa.Column('severity', sa.String(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('visible_details', sa.Text(), nullable=True),
        sa.Column('thermal_details', sa.Text(), nullable=True),
        sa.Column('recommendations', sa.Text(), nullable=True),
        sa.Column('analysis_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('has_been_viewed', sa.Boolean(), nullable=True),
        sa.Column('resolution_notes', sa.Text(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolved_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['resolved_by'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_dronereport_id'), 'dronereport', ['id'], unique=False)
    op.create_index(op.f('ix_dronereport_report_id'), 'dronereport', ['report_id'], unique=True)
    
    # Create dronereportphoto table
    op.create_table(
        'dronereportphoto',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('report_id', sa.Integer(), nullable=False),
        sa.Column('filename', sa.String(), nullable=False),
        sa.Column('file_path', sa.String(), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('mime_type', sa.String(), nullable=True),
        sa.Column('photo_type', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['report_id'], ['dronereport.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_dronereportphoto_id'), 'dronereportphoto', ['id'], unique=False)
    
    # Insert default drone AI settings
    op.execute(
        """
        INSERT INTO droneaisetting (key, value, description)
        VALUES 
            ('drone_ai_enabled', 'false', 'Enable or disable drone AI analysis'),
            ('drone_frame_type', 'regular', 'Type of frames to analyze (regular, thermal, or both)')
        """
    )


def downgrade():
    op.drop_index(op.f('ix_dronereportphoto_id'), table_name='dronereportphoto')
    op.drop_table('dronereportphoto')
    op.drop_index(op.f('ix_dronereport_report_id'), table_name='dronereport')
    op.drop_index(op.f('ix_dronereport_id'), table_name='dronereport')
    op.drop_table('dronereport')
    op.drop_index(op.f('ix_droneaisetting_key'), table_name='droneaisetting')
    op.drop_index(op.f('ix_droneaisetting_id'), table_name='droneaisetting')
    op.drop_table('droneaisetting')