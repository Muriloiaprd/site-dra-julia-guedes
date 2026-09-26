import uuid
import datetime as dt

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from kactus_api.db import Base


class DailyMetric(Base):
    __tablename__ = "daily_metrics"
    __table_args__ = (
        UniqueConstraint("user_id", "date", "sport", name="uq_daily_metrics_user_date_sport"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    date: Mapped[dt.date] = mapped_column(Date(), nullable=False)
    sport: Mapped[str | None] = mapped_column(String(50), nullable=True)
    daily_load: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    ctl: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    atl: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    tsb: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    acwr: Mapped[float | None] = mapped_column(Numeric(5, 3), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)
