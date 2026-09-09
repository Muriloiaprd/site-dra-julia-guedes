"""activities: enums sport/activity_source + activities, activity_points, activity_laps

Revision ID: 002_activities
Revises: 001_initial
Create Date: 2026-09-09
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002_activities"
down_revision: str | None = "001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SPORT_VALUES = (
    "run", "trail_run", "treadmill", "bike", "mtb", "gravel",
    "indoor_bike", "swim", "open_water_swim", "multisport", "other",
)
SOURCE_VALUES = ("fit", "gpx", "tcx", "csv", "garmin_api", "manual")


def _updated_at_trigger(table: str) -> str:
    return (
        f"CREATE TRIGGER trg_{table}_updated_at BEFORE UPDATE ON {table} "
        f"FOR EACH ROW EXECUTE FUNCTION set_updated_at();"
    )


def upgrade() -> None:
    sport = postgresql.ENUM(*SPORT_VALUES, name="sport")
    source = postgresql.ENUM(*SOURCE_VALUES, name="activity_source")
    sport.create(op.get_bind())
    source.create(op.get_bind())

    op.create_table(
        "activities",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sport", postgresql.ENUM(*SPORT_VALUES, name="sport", create_type=False), nullable=False),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("timezone", sa.String(50), server_default="America/Sao_Paulo"),
        sa.Column("duration_s", sa.Integer(), nullable=False),
        sa.Column("moving_time_s", sa.Integer()),
        sa.Column("distance_m", sa.Numeric(10, 2)),
        sa.Column("elevation_gain_m", sa.Numeric(8, 2)),
        sa.Column("elevation_loss_m", sa.Numeric(8, 2)),
        sa.Column("elevation_max_m", sa.Numeric(8, 2)),
        sa.Column("elevation_min_m", sa.Numeric(8, 2)),
        sa.Column("avg_hr", sa.SmallInteger()),
        sa.Column("max_hr", sa.SmallInteger()),
        sa.Column("avg_pace_s_per_km", sa.Numeric(6, 2)),
        sa.Column("avg_speed_kmh", sa.Numeric(5, 2)),
        sa.Column("max_speed_kmh", sa.Numeric(5, 2)),
        sa.Column("avg_cadence", sa.Numeric(5, 2)),
        sa.Column("avg_power_w", sa.SmallInteger()),
        sa.Column("max_power_w", sa.SmallInteger()),
        sa.Column("normalized_power_w", sa.SmallInteger()),
        sa.Column("avg_temperature_c", sa.Numeric(4, 1)),
        sa.Column("calories", sa.Integer()),
        sa.Column("tss", sa.Numeric(6, 2)),
        sa.Column("intensity_factor", sa.Numeric(4, 3)),
        sa.Column("variability_index", sa.Numeric(4, 3)),
        sa.Column("source", postgresql.ENUM(*SOURCE_VALUES, name="activity_source", create_type=False), nullable=False),
        sa.Column("source_activity_id", sa.String(100)),
        sa.Column("file_hash", sa.String(64)),
        sa.Column("file_path", sa.Text()),
        sa.Column("title", sa.String(255)),
        sa.Column("description", sa.Text()),
        sa.Column("weather", postgresql.JSONB()),
        sa.Column("location_start_lat", sa.Numeric(10, 7)),
        sa.Column("location_start_lon", sa.Numeric(10, 7)),
        sa.Column("location_end_lat", sa.Numeric(10, 7)),
        sa.Column("location_end_lon", sa.Numeric(10, 7)),
        sa.Column("polyline_encoded", sa.Text()),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("user_id", "file_hash", name="uq_activity_user_filehash"),
    )
    op.create_index("ix_activities_user_start", "activities", ["user_id", "start_time"])
    op.create_index("ix_activities_user_sport_start", "activities", ["user_id", "sport", "start_time"])
    op.create_index(
        "ix_activities_user_active", "activities", ["user_id", "deleted_at"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.execute(_updated_at_trigger("activities"))

    op.create_table(
        "activity_points",
        sa.Column("activity_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("activities.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("elapsed_time_s", sa.Integer(), primary_key=True),
        sa.Column("lat", sa.Numeric(10, 7)),
        sa.Column("lon", sa.Numeric(10, 7)),
        sa.Column("altitude_m", sa.Numeric(7, 2)),
        sa.Column("distance_m", sa.Numeric(10, 2)),
        sa.Column("hr", sa.SmallInteger()),
        sa.Column("cadence", sa.SmallInteger()),
        sa.Column("power_w", sa.SmallInteger()),
        sa.Column("speed_ms", sa.Numeric(6, 3)),
        sa.Column("temperature_c", sa.Numeric(4, 1)),
    )

    op.create_table(
        "activity_laps",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("activity_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("activities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lap_index", sa.SmallInteger(), nullable=False),
        sa.Column("lap_type", sa.String(20)),
        sa.Column("start_elapsed_s", sa.Integer()),
        sa.Column("duration_s", sa.Integer()),
        sa.Column("distance_m", sa.Numeric(10, 2)),
        sa.Column("avg_pace_s_per_km", sa.Numeric(6, 2)),
        sa.Column("avg_speed_kmh", sa.Numeric(5, 2)),
        sa.Column("avg_hr", sa.SmallInteger()),
        sa.Column("max_hr", sa.SmallInteger()),
        sa.Column("avg_power_w", sa.SmallInteger()),
        sa.Column("avg_cadence", sa.SmallInteger()),
        sa.Column("elevation_gain_m", sa.Numeric(7, 2)),
        sa.UniqueConstraint("activity_id", "lap_index", name="uq_activity_lap_index"),
    )


def downgrade() -> None:
    op.drop_table("activity_laps")
    op.drop_table("activity_points")
    op.drop_table("activities")
    op.execute("DROP TYPE IF EXISTS activity_source;")
    op.execute("DROP TYPE IF EXISTS sport;")
