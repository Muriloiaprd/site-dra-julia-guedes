from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=[".env", "../../.env"],
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = Field(default="postgresql+psycopg://ondilow:ondilow@localhost:5432/ondilow")

    jwt_secret_key: str = Field(default="dev-secret-change-me")
    jwt_algorithm: str = Field(default="HS256")
    jwt_expire_minutes: int = Field(default=10080)

    allow_registration: bool = Field(default=False)
    initial_user_email: str | None = Field(default=None)
    initial_user_password: str | None = Field(default=None)

    fernet_key: str | None = Field(default=None)

    app_env: str = Field(default="dev")
    log_level: str = Field(default="INFO")
    cors_origins: str = Field(default="http://localhost:3000")

    gps_downsample_seconds: int = Field(default=3)

    data_dir: str = Field(default="./data")

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def data_path(self) -> Path:
        return Path(self.data_dir).resolve()


settings = Settings()
