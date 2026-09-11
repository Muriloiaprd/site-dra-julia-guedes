from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_PROJECT_ENV_FILE = Path(__file__).resolve().parents[3] / ".env"
_DEFAULT_DATA_DIR = "./data"
# Ancora o data_dir padrao no diretorio da API, nao no CWD do processo:
# uvicorn iniciado da raiz do repo resolvia "./data" para outro lugar.
_PROJECT_DATA_DIR = Path(__file__).resolve().parents[1] / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=[".env", "../../.env", _PROJECT_ENV_FILE],
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
    cors_origins: str = Field(default="http://localhost:3000,http://localhost:3003")

    gps_downsample_seconds: int = Field(default=3)

    data_dir: str = Field(default=_DEFAULT_DATA_DIR)

    anthropic_api_key: str | None = Field(default=None)
    anthropic_model: str = Field(default="claude-opus-5")
    gemini_api_key: str | None = Field(default=None)
    gemini_model: str = Field(default="gemini-2.0-flash")
    coach_prompt_version: str = Field(default="v1")

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def data_path(self) -> Path:
        if self.data_dir == _DEFAULT_DATA_DIR:
            return _PROJECT_DATA_DIR
        return Path(self.data_dir).resolve()


settings = Settings()
