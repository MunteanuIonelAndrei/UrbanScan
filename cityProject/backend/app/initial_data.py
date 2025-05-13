import logging
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.core.config import settings
from app.utils.db import create_first_superuser

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def init_db(db: Session) -> None:
    """
    Initialize the database with the first superuser.
    """
    # Create first superuser if not exists
    user = create_first_superuser(
        db=db,
        username=settings.FIRST_ADMIN_USERNAME,
        password=settings.FIRST_ADMIN_PASSWORD,
    )
    if user:
        logger.info(f"Created first superuser: {user.username}")
    else:
        logger.info("Superuser already exists. Skipping.")


def main() -> None:
    """
    Initialize the application.
    """
    logger.info("Creating initial data")
    db = SessionLocal()
    try:
        init_db(db)
        logger.info("Initial data created")
    finally:
        db.close()


if __name__ == "__main__":
    main()