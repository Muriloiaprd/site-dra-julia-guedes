"""
Infra de teste de integracao (TestClient + Postgres real).

Roda contra a branch Neon `test` do projeto Ondilow (br-solitary-poetry-acj7i9ej),
uma copia isolada (copy-on-write) da `main` -- escrever ou apagar dados aqui
NUNCA toca na `main` (onde estao as atividades reais do usuario). O
DATABASE_URL e forcado por variavel de ambiente ANTES de qualquer import de
`kactus_api`, porque `Settings()` e instanciado uma vez, no import de
`kactus_api.config` -- se algum modulo do app fosse importado antes desta
linha, o `.env` da raiz (que aponta pro Neon de producao) venceria.

A string de conexao (com a senha da branch de teste) fica em `TEST_DATABASE_URL`
no `.env` da raiz do projeto -- gitignored, nunca commitada. Se essa variavel
nao estiver definida, os testes de integracao falham com uma mensagem clara em
vez de silenciosamente caírem no DATABASE_URL de producao.

A trava abaixo e defesa em profundidade: mesmo que o override acima seja
removido por engano no futuro, o teste falha alto (AssertionError) em vez de
rodar silenciosamente contra o banco real.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

_PROJECT_ENV_FILE = Path(__file__).resolve().parents[3] / ".env"
load_dotenv(_PROJECT_ENV_FILE)

_TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
if not _TEST_DATABASE_URL:
    raise RuntimeError(
        "TEST_DATABASE_URL nao definida em Kactus/.env -- necessaria para rodar "
        "os testes de integracao contra a branch Neon `test`, isolada da producao. "
        "Ver apps/api/tests/conftest.py."
    )
_PROD_HOST_FRAGMENT = "ep-tiny-rain-acyg4qmw"  # host da main, ver Kactus/.env

os.environ["DATABASE_URL"] = _TEST_DATABASE_URL
os.environ["ALLOW_REGISTRATION"] = "true"

import subprocess  # noqa: E402
import uuid  # noqa: E402
from collections.abc import Generator  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import event  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402

from kactus_api.db import engine, get_db  # noqa: E402
from kactus_api.main import app  # noqa: E402
from kactus_api.rate_limit import limiter  # noqa: E402
from kactus_api.security import hash_password  # noqa: E402

_API_ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="session", autouse=True)
def _migrate_test_db() -> None:
    assert _PROD_HOST_FRAGMENT not in str(engine.url), (
        "SEGURANCA: engine de teste resolveu para o host de producao "
        f"({engine.url!r}). Os testes nunca podem rodar contra a main."
    )
    subprocess.run(
        ["uv", "run", "alembic", "upgrade", "head"],
        cwd=_API_ROOT,
        env={**os.environ, "DATABASE_URL": _TEST_DATABASE_URL},
        check=True,
        capture_output=True,
    )


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    """Uma sessao por teste, dentro de uma transacao externa sempre revertida
    no fim -- nenhum teste deixa dado para o proximo. Os routers chamam
    `db.commit()` de verdade (login grava last_login_at, change-password troca
    a senha, etc.) -- se isso encerrasse a transacao externa, o rollback final
    nao desfaria nada. Por isso a sessao roda dentro de uma SAVEPOINT
    (`begin_nested`): o `commit()` do app fecha so a savepoint, e o listener
    abre a proxima na hora; só a transacao externa (nunca commitada) e
    revertida no final. Padrao recomendado pela propria documentacao do
    SQLAlchemy para isolar testes de integracao."""
    connection = engine.connect()
    outer_transaction = connection.begin()
    session_factory = sessionmaker(bind=connection, autoflush=False, autocommit=False, expire_on_commit=False)
    session = session_factory()

    nested = connection.begin_nested()

    @event.listens_for(session, "after_transaction_end")
    def _restart_savepoint(sess: Session, trans: object) -> None:
        nonlocal nested
        if not nested.is_active:
            nested = connection.begin_nested()

    yield session

    session.close()
    outer_transaction.rollback()
    connection.close()


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def _override_get_db() -> Generator[Session, None, None]:
        # Em producao cada request ganha uma SessionLocal() nova (get_db em
        # db.py), entao um relationship como `current_user.profile` sempre
        # carrega fresco. Aqui a mesma `db_session` atende todas as chamadas
        # do teste (e o que nos da o rollback de isolamento), entao sem
        # expirar o cache entre requests um objeto lazy-loaded como None numa
        # chamada (perfil ainda nao existia) fica None para sempre no mesmo
        # processo Python, mesmo depois de outra chamada criar o perfil.
        db_session.expire_all()
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def auth_client(client: TestClient, db_session: Session) -> Generator[tuple[TestClient, dict], None, None]:
    """Cliente autenticado com um usuario novo (email aleatorio), token no
    header Authorization. Retorna (client, user_info) com id/email/password."""
    from kactus_api.models import User

    email = f"pytest-{uuid.uuid4().hex[:12]}@kactus.test"
    password = "senha-de-teste-123"
    user = User(email=email, password_hash=hash_password(password))
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    # o rate limit de /auth/login (5/min) e por IP; o TestClient sempre usa o
    # mesmo IP fake, entao sem resetar aqui o 6o teste que loga esbarra em 429.
    limiter.reset()
    resp = client.post("/auth/login", data={"username": email, "password": password})
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"

    yield client, {"id": user.id, "email": email, "password": password}
