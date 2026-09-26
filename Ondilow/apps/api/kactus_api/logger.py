"""Logger estruturado reutilizável, sobre o structlog configurado em logging_setup.py."""

import structlog


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name)
