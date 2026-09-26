import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ENUM, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from kactus_api.db import Base

SPORT_VALUES = (
    "run",
    "trail_run",
    "treadmill",
    "bike",
    "mtb",
    "gravel",
    "indoor_bike",
    "swim",
    "open_water_swim",
    "multisport",
    "walk",
    "strength",
    "pilates",
    "other",
)
SOURCE_VALUES = ("fit", "gpx", "tcx", "csv", "garmin_api", "strava_api", "manual")

sport_enum = ENUM(*SPORT_VALUES, name="sport", create_type=False)
source_enum = ENUM(*SOURCE_VALUES, name="activity_source", create_type=False)


class Activity(Base):
    __tablename__ = "activities"

    __table_args__ = (
        UniqueConstraint("user_id", "file_hash", name="uq_activity_user_filehash"),
        Index("ix_activities_user_start", "user_id", "start_time"),
        Index("ix_activities_user_sport_start", "user_id", "sport", "start_time"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    equipment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("equipment.id", ondelete="SET NULL")
    )
    sport: Mapped[str] = mapped_column(sport_enum, nullable=False)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), server_default="America/Sao_Paulo")
    duration_s: Mapped[int] = mapped_column(Integer, nullable=False)
    moving_time_s: Mapped[int | None] = mapped_column(Integer)
    distance_m: Mapped[float | None] = mapped_column(Numeric(10, 2))
    elevation_gain_m: Mapped[float | None] = mapped_column(Numeric(8, 2))
    elevation_loss_m: Mapped[float | None] = mapped_column(Numeric(8, 2))
    elevation_max_m: Mapped[float | None] = mapped_column(Numeric(8, 2))
    elevation_min_m: Mapped[float | None] = mapped_column(Numeric(8, 2))
    avg_hr: Mapped[int | None] = mapped_column(SmallInteger)
    max_hr: Mapped[int | None] = mapped_column(SmallInteger)
    avg_pace_s_per_km: Mapped[float | None] = mapped_column(Numeric(6, 2))
    avg_speed_kmh: Mapped[float | None] = mapped_column(Numeric(5, 2))
    max_speed_kmh: Mapped[float | None] = mapped_column(Numeric(5, 2))
    avg_cadence: Mapped[float | None] = mapped_column(Numeric(5, 2))
    # Derivados da serie de pontos (services/derived_metrics.py). derived_version
    # nulo = atividade ainda nao passou pelo calculo (nem pela correcao de cadencia).
    gap_pace_s_per_km: Mapped[float | None] = mapped_column(Numeric(6, 2))
    hr_decoupling_pct: Mapped[float | None] = mapped_column(Numeric(5, 2))
    derived_version: Mapped[int | None] = mapped_column(SmallInteger)
    avg_power_w: Mapped[int | None] = mapped_column(SmallInteger)
    max_power_w: Mapped[int | None] = mapped_column(SmallInteger)
    normalized_power_w: Mapped[int | None] = mapped_column(SmallInteger)
    avg_temperature_c: Mapped[float | None] = mapped_column(Numeric(4, 1))
    calories: Mapped[int | None] = mapped_column(Integer)
    tss: Mapped[float | None] = mapped_column(Numeric(6, 2))
    intensity_factor: Mapped[float | None] = mapped_column(Numeric(4, 3))
    variability_index: Mapped[float | None] = mapped_column(Numeric(4, 3))
    source: Mapped[str] = mapped_column(source_enum, nullable=False)
    source_activity_id: Mapped[str | None] = mapped_column(String(100))
    file_hash: Mapped[str | None] = mapped_column(String(64))
    file_path: Mapped[str | None] = mapped_column(Text)
    title: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    # Check-in pos-treino (opcional, preenchido pelo atleta): carga interna e
    # sinais subjetivos que o arquivo do relogio nao tem.
    rpe: Mapped[int | None] = mapped_column(SmallInteger)  # PSE 0-10 (Borg CR10)
    pain_level: Mapped[int | None] = mapped_column(SmallInteger)  # 0-10
    pain_location: Mapped[str | None] = mapped_column(String(100))
    feeling: Mapped[str | None] = mapped_column(String(30))
    checkin_notes: Mapped[str | None] = mapped_column(Text)
    checkin_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    weather: Mapped[dict | None] = mapped_column(JSONB)
    location_start_lat: Mapped[float | None] = mapped_column(Numeric(10, 7))
    location_start_lon: Mapped[float | None] = mapped_column(Numeric(10, 7))
    location_end_lat: Mapped[float | None] = mapped_column(Numeric(10, 7))
    location_end_lon: Mapped[float | None] = mapped_column(Numeric(10, 7))
    polyline_encoded: Mapped[str | None] = mapped_column(Text)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    @property
    def srpe(self) -> float | None:
        """Carga interna (sRPE, Foster): PSE x minutos em movimento."""
        if self.rpe is None:
            return None
        minutes = (self.moving_time_s or self.duration_s) / 60
        return round(self.rpe * minutes, 1)

    points: Mapped[list["ActivityPoint"]] = relationship(
        "ActivityPoint",
        back_populates="activity",
        cascade="all, delete-orphan",
        order_by="ActivityPoint.elapsed_time_s",
    )
    laps: Mapped[list["ActivityLap"]] = relationship(
        "ActivityLap",
        back_populates="activity",
        cascade="all, delete-orphan",
        order_by="ActivityLap.lap_index",
    )


class ActivityPoint(Base):
    __tablename__ = "activity_points"

    activity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("activities.id", ondelete="CASCADE"), primary_key=True
    )
    elapsed_time_s: Mapped[int] = mapped_column(Integer, primary_key=True)
    lat: Mapped[float | None] = mapped_column(Numeric(10, 7))
    lon: Mapped[float | None] = mapped_column(Numeric(10, 7))
    altitude_m: Mapped[float | None] = mapped_column(Numeric(7, 2))
    distance_m: Mapped[float | None] = mapped_column(Numeric(10, 2))
    hr: Mapped[int | None] = mapped_column(SmallInteger)
    cadence: Mapped[int | None] = mapped_column(SmallInteger)
    power_w: Mapped[int | None] = mapped_column(SmallInteger)
    speed_ms: Mapped[float | None] = mapped_column(Numeric(6, 3))
    temperature_c: Mapped[float | None] = mapped_column(Numeric(4, 1))

    activity: Mapped[Activity] = relationship("Activity", back_populates="points")


class ActivityLap(Base):
    __tablename__ = "activity_laps"

    __table_args__ = (
        UniqueConstraint("activity_id", "lap_index", name="uq_activity_lap_index"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    activity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("activities.id", ondelete="CASCADE"), nullable=False
    )
    lap_index: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    lap_type: Mapped[str | None] = mapped_column(String(20))
    start_elapsed_s: Mapped[int | None] = mapped_column(Integer)
    duration_s: Mapped[int | None] = mapped_column(Integer)
    distance_m: Mapped[float | None] = mapped_column(Numeric(10, 2))
    avg_pace_s_per_km: Mapped[float | None] = mapped_column(Numeric(6, 2))
    gap_pace_s_per_km: Mapped[float | None] = mapped_column(Numeric(6, 2))
    avg_speed_kmh: Mapped[float | None] = mapped_column(Numeric(5, 2))
    avg_hr: Mapped[int | None] = mapped_column(SmallInteger)
    max_hr: Mapped[int | None] = mapped_column(SmallInteger)
    avg_power_w: Mapped[int | None] = mapped_column(SmallInteger)
    avg_cadence: Mapped[int | None] = mapped_column(SmallInteger)
    elevation_gain_m: Mapped[float | None] = mapped_column(Numeric(7, 2))

    activity: Mapped[Activity] = relationship("Activity", back_populates="laps")
