"""Cria o usuario inicial a partir das variaveis INITIAL_USER_* do .env.

Idempotente: se o email ja existe, nao faz nada.
Rodar: uv run python -m kactus_api.scripts.seed_user
"""

from sqlalchemy import select

from kactus_api.config import settings
from kactus_api.db import SessionLocal
from kactus_api.models import AthleteProfile, User
from kactus_api.security import hash_password


def main() -> None:
    if not settings.initial_user_email or not settings.initial_user_password:
        raise SystemExit("Defina INITIAL_USER_EMAIL e INITIAL_USER_PASSWORD no .env")

    with SessionLocal() as db:
        existing = db.execute(
            select(User).where(User.email == settings.initial_user_email)
        ).scalar_one_or_none()
        if existing:
            print(f"Usuario ja existe: {settings.initial_user_email}")
            return

        user = User(
            email=settings.initial_user_email,
            password_hash=hash_password(settings.initial_user_password),
        )
        user.profile = AthleteProfile()
        db.add(user)
        db.commit()
        print(f"Usuario criado: {settings.initial_user_email}")


if __name__ == "__main__":
    main()
