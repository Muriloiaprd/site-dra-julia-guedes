"""Importação em lote (tela /import e relógio pelo USB): resumo e duplicados."""

from pathlib import Path

from sqlalchemy.orm import Session

from kactus_api.models import User
from kactus_api.scripts.import_files import resumo
from kactus_api.security import hash_password
from kactus_api.services.batch_import import import_batch

_FIXTURES = Path(__file__).parent / "fixtures"


def test_import_batch_counts_new_duplicates_and_errors(db_session: Session, monkeypatch) -> None:
    from kactus_api.config import settings

    monkeypatch.setattr(settings, "persist_raw_uploads", False)
    user = User(email="pytest-lote@kactus.test", password_hash=hash_password("x" * 12))
    db_session.add(user)
    db_session.commit()
    gpx = (_FIXTURES / "sample_run.gpx").read_bytes()

    first = resumo(import_batch(db_session, user.id, [("corrida.gpx", gpx), ("vazio.fit", b""), ("x.txt", b"oi")]))
    again = resumo(import_batch(db_session, user.id, [("corrida.gpx", gpx)]))

    assert first["importadas"] == 1 and len(first["atividades"]) == 1
    assert [e["arquivo"] for e in first["erros"]] == ["vazio.fit", "x.txt"]
    assert again == {"importadas": 0, "duplicadas": 1, "erros": [], "atividades": []}
