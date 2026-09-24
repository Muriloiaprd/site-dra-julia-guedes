from pathlib import Path

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_PROJECT_ENV_FILE = Path(__file__).resolve().parents[3] / ".env"
_DEFAULT_DATA_DIR = "./data"
_DEFAULT_JWT_SECRET = "dev-secret-change-me"
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

    jwt_secret_key: str = Field(default=_DEFAULT_JWT_SECRET)
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
    # Desligar em deploy sem disco persistente (logs vao so para stdout; o
    # arquivo original do upload nao e guardado -- ninguem le file_path).
    log_to_file: bool = Field(default=True)
    persist_raw_uploads: bool = Field(default=True)

    anthropic_api_key: str | None = Field(default=None)
    anthropic_model: str = Field(default="claude-opus-5")
    gemini_api_key: str | None = Field(default=None)
    # Lista em ordem de preferencia; o proximo so e usado se o anterior estiver
    # sobrecarregado (503/504) ou estourar o tempo. Medido no free tier em
    # 2026-09-21: o Lite respondeu o chat real em 2,7s; 3.7-flash e 3.5-flash
    # deram 503/504 depois de minutos na fila.
    gemini_model: str = Field(default="gemini-3.5-flash-lite,gemini-3.5-flash")
    coach_prompt_version: str = Field(default="v3")

    @model_validator(mode="after")
    def _fail_fast_outside_dev(self) -> "Settings":
        """Melhor um deploy que nao sobe do que uma API publica com segredo conhecido."""
        if self.app_env == "dev":
            return self
        problems = []
        if self.jwt_secret_key == _DEFAULT_JWT_SECRET or len(self.jwt_secret_key) < 32:
            problems.append("JWT_SECRET_KEY deve ser diferente do default e ter >= 32 caracteres")
        if any(h in self.database_url for h in ("@localhost", "@127.0.0.1")):
            problems.append("DATABASE_URL nao pode apontar para localhost")
        if problems:
            raise ValueError(f"Configuracao invalida para APP_ENV={self.app_env}: " + "; ".join(problems))
        return self

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def data_path(self) -> Path:
        if self.data_dir == _DEFAULT_DATA_DIR:
            return _PROJECT_DATA_DIR
        return Path(self.data_dir).resolve()


settings = Settings()
