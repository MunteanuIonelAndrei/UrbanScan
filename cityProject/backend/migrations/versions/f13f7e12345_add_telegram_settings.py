"""add_telegram_settings

Revision ID: f13f7e12345
Revises: ec2500b781a6
Create Date: 2025-05-12 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f13f7e12345'
down_revision = 'ec2500b781a6'
branch_labels = None
depends_on = None


def upgrade():
    # Insert Telegram notification settings
    try:
        op.execute(
            "INSERT INTO system_setting (key, value, description) VALUES "
            "('telegram_notifications_enabled', 'false', 'Enable or disable Telegram notifications for critical reports'), "
            "('telegram_bot_token', '', 'Telegram bot token for sending notifications'), "
            "('telegram_chat_id', '', 'Telegram chat ID where notifications will be sent'), "
            "('telegram_notify_severity', 'critical', 'Comma-separated list of severity levels that will trigger notifications')"
        )
        print("Successfully added Telegram settings to system_setting table")
    except Exception as e:
        print(f"Error inserting Telegram settings: {str(e)}")
        # Continue with migration even if insert fails (settings might already exist)
        pass


def downgrade():
    # Remove Telegram notification settings
    try:
        op.execute("DELETE FROM system_setting WHERE key = 'telegram_notifications_enabled'")
        op.execute("DELETE FROM system_setting WHERE key = 'telegram_bot_token'")
        op.execute("DELETE FROM system_setting WHERE key = 'telegram_chat_id'")
        op.execute("DELETE FROM system_setting WHERE key = 'telegram_notify_severity'")
        print("Successfully removed Telegram settings from system_setting table")
    except Exception as e:
        print(f"Error removing Telegram settings: {str(e)}")
        pass