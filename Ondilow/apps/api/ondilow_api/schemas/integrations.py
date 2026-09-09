from datetime import datetime

from pydantic import BaseModel, Field


class GarminCredentials(BaseModel):
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=1)


class IntegrationStatus(BaseModel):
    provider: str
    is_enabled: bool
    last_sync_at: datetime | None = None
    last_sync_status: str | None = None
    last_sync_error: str | None = None
    has_credentials: bool


class SyncResultOut(BaseModel):
    imported: int
    skipped: int
    errors: list[str]
