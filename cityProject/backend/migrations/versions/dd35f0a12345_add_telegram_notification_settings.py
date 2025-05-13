"""add_telegram_notification_settings

Revision ID: dd35f0a12345
Revises: 7040734af8cb
Create Date: 2025-05-12 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'dd35f0a12345'
down_revision = '7040734af8cb'
branch_labels = None
depends_on = None


def upgrade():
    # Insert default Telegram notification settings
    op.execute(
        "INSERT INTO system_setting (key, value, description) VALUES "
        "('telegram_notifications_enabled', 'false', 'Enable or disable Telegram notifications for critical reports'), "
        "('telegram_bot_token', '', 'Telegram bot token for sending notifications'), "
        "('telegram_chat_id', '', 'Telegram chat ID where notifications will be sent'), "
        "('telegram_notify_severity', 'critical', 'Comma-separated list of severity levels that will trigger notifications')"
    )


def downgrade():
    # Remove Telegram notification settings
    op.execute("DELETE FROM system_setting WHERE key = 'telegram_notifications_enabled'")
    op.execute("DELETE FROM system_setting WHERE key = 'telegram_bot_token'")
    op.execute("DELETE FROM system_setting WHERE key = 'telegram_chat_id'")
    op.execute("DELETE FROM system_setting WHERE key = 'telegram_notify_severity'")