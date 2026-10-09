"""Backup semanal: só roda quando passou uma semana; falha vira aviso."""

from pathlib import Path

from kactus_controle.backup import SEMANA_S, VigiaBackup, texto_backup


def _vigia(ultimo, avisos, rodar, agora=1_000_000_000.0):
    return VigiaBackup(
        ultimo=lambda: ultimo, pasta=lambda: Path("x"), ao_terminar=lambda t, r: avisos.append((t, r)),
        rodar=rodar, agora=lambda: agora,
    )


def test_due_only_after_a_week() -> None:
    agora = 1_000_000_000.0
    assert _vigia(None, [], lambda p: {}).vencido()
    assert not _vigia(agora - SEMANA_S + 60, [], lambda p: {}, agora).vencido()
    assert _vigia(agora - SEMANA_S, [], lambda p: {}, agora).vencido()


def test_runs_and_reports() -> None:
    avisos = []
    res = {"arquivo": "a.json.gz", "tamanho": 7_860_000, "apagados": 0}
    assert _vigia(None, avisos, lambda p: res).fazer() == res
    assert avisos == [("Backup do Kactus salvo (7,9 MB)", res)]
    assert texto_backup({"tamanho": 0}) == "Backup do Kactus salvo (0,0 MB)"


def test_failure_becomes_a_warning() -> None:
    avisos = []

    def quebra(_pasta):
        raise RuntimeError("banco fora do ar")

    assert _vigia(None, avisos, quebra).fazer() is None
    assert avisos == [("Não consegui fazer o backup do Kactus: banco fora do ar", None)]
