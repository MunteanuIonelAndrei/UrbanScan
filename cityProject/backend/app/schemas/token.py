from typing import Optional
from pydantic import BaseModel, ConfigDict


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenPayload(BaseModel):
    sub: Optional[int] = None
    exp: Optional[int] = None


class TokenData(BaseModel):
    username: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)