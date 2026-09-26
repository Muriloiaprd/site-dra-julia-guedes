import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String, func
from sqlalchemy.dialects.postgresql import ENUM, UUID
from sqlalchemy.orm import Mapped, mapped_column

from kactus_api.db import Base
from kactus_api.models.activity import sport_enum

RECORD_TYPE_VALUES = (
    "fastest_1k",
    "fastest_5k",
    "fastest_10k",
    "fastest_21k",
    "fastest_42k",
    "longest_run",
    "longest_ride",
    "longest_swim",
    "most_elevation_gain",
    "fastest_100m_swim",
    "fastest_400m_swim",
    "max_hr_recorded",
    "max_power_1s",
    "best_power_5min",
    "best_power_20min",
    "best_power_60min",
    "ftp_estimated",
    "css_estimated",
    "vo2max_estimated",
)

record_type_enum = ENUM(*RECORD_TYPE_VALUES, name="record_type", create_type=False)


class PersonalRecord(Base):
    __tablename__ = "personal_records"

    __table_args__ = (
        Index(
            "ix_records_user_sport_type_time",
            "user_id",
            "sport",
            "record_type",
            "achieved_at",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    sport: Mapped[str] = mapped_column(sport_enum, nullable=False)
    record_type: Mapped[str] = mapped_column(record_type_enum, nullable=False)
    value: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    activity_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("activities.id", ondelete="SET NULL")
    )
    achieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    previous_value: Mapped[float | None] = mapped_column(Numeric(10, 2))
    previous_activity_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("activities.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
