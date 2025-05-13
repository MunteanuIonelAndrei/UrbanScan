from typing import Any, Dict, Optional, Union, List

from sqlalchemy.orm import Session

from app import models, schemas
from app.core.security import get_password_hash, verify_password


# User utils
def get_user(db: Session, id: int) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.id == id).first()


def get_user_by_username(db: Session, username: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.username == username).first()


def get_users(db: Session, skip: int = 0, limit: int = 100) -> List[models.User]:
    return db.query(models.User).offset(skip).limit(limit).all()


def create_user(db: Session, obj_in: schemas.UserCreate) -> models.User:
    db_obj = models.User(
        username=obj_in.username,
        email=obj_in.email,
        hashed_password=get_password_hash(obj_in.password),
        full_name=obj_in.full_name,
        is_superuser=obj_in.is_superuser,
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def update_user(
    db: Session, *, db_obj: models.User, obj_in: Union[schemas.UserUpdate, Dict[str, Any]]
) -> models.User:
    if isinstance(obj_in, dict):
        update_data = obj_in
    else:
        update_data = obj_in.model_dump(exclude_unset=True)
    
    if "password" in update_data and update_data["password"]:
        hashed_password = get_password_hash(update_data["password"])
        del update_data["password"]
        update_data["hashed_password"] = hashed_password
    
    for field in update_data:
        if field in update_data:
            setattr(db_obj, field, update_data[field])
    
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def delete_user(db: Session, *, id: int) -> models.User:
    user = db.query(models.User).filter(models.User.id == id).first()
    db.delete(user)
    db.commit()
    return user


def authenticate_user(db: Session, username: str, password: str) -> Optional[models.User]:
    user = get_user_by_username(db, username=username)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


# First superuser utils
def create_first_superuser(db: Session, username: str, password: str) -> Optional[models.User]:
    user = get_user_by_username(db, username=username)
    if user:
        return user
    
    user_in = schemas.UserCreate(
        username=username,
        password=password,
        is_superuser=True,
    )
    user = create_user(db, user_in)
    return user