import logging
import sys
from logging.handlers import TimedRotatingFileHandler
from pathlib import Path

import structlog

from ondilow_api.config import settings


def configure_logging() -> None:
    level = getattr(logging, settings.log_level.upper(), logging.INFO)

    handlers: list[logging.Handler] = [logging.StreamHandler(sys.stdout)]
    if settings.log_to_file:
        log_dir = settings.data_path / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        handlers.append(_rotating_file_handler(log_dir / "app.jsonl"))

    logging.basicConfig(format="%(message)s", level=level, handlers=handlers)

    processors: list = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
    ]
    if settings.app_env == "dev":
        processors.append(structlog.dev.ConsoleRenderer())
    else:
        processors.append(structlog.processors.JSONRenderer())

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(level),
        cache_logger_on_first_use=True,
    )


def _rotating_file_handler(path: Path) -> TimedRotatingFileHandler:
    handler = TimedRotatingFileHandler(
        filename=path,
        when="midnight",
        backupCount=14,
        encoding="utf-8",
    )
    handler.setFormatter(logging.Formatter("%(message)s"))
    return handler
