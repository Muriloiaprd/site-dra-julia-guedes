"""Sync do Garmin: a cada 3 h da última tentativa, só avisa o que importa e não repete aviso."""

from kactus_controle.garmin import INTERVALO_S, VigiaGarmin, merece_aviso, texto_sync

AGORA = 1_000_000_000.0


def _vigia(ultimo, avisos, rodar, tentativas=None):
    return VigiaGarmin(
        ativo=lambda: True,
        ultimo=lambda: ultimo,
        ao_tentar=lambda q: (tentativas if tentativas is not None else []).append(q),
        ao_terminar=lambda t, r, avisar: avisos.append((t, avisar)),
        rodar=rodar,
        agora=lambda: AGORA,
    )


def test_due_only_three_hours_after_last_try() -> None:
    assert _vigia(None, [], dict).vencido()
    assert not _vigia(AGORA - INTERVALO_S + 60, [], dict).vencido()
    assert _vigia(AGORA - INTERVALO_S, [], dict).vencido()


def test_new_activities_are_notified_and_try_is_recorded() -> None:
    avisos, tentativas = [], []
    res = {"importadas": 2, "duplicadas": 1, "erros": 0, "parou": None, "erro": None}
    assert _vigia(None, avisos, lambda: res, tentativas).sincronizar() == res
    assert tentativas == [AGORA]
    assert avisos == [("2 treinos novos do Garmin no Kactus · 1 já estava lá", True)]


def test_nothing_new_only_updates_the_window() -> None:
    avisos = []
    _vigia(None, avisos, lambda: {"importadas": 0, "duplicadas": 3}).sincronizar()
    assert avisos == [("Nada novo no Garmin · 3 já estavam lá", False)]


def test_manual_run_always_notifies() -> None:
    avisos = []
    _vigia(None, avisos, lambda: {"importadas": 0}).sincronizar(manual=True)
    assert avisos == [("Nada novo no Garmin", True)]


def test_same_error_is_not_notified_twice() -> None:
    avisos = []
    sem_chave = {"erro": "Falta a chave pessoal do Garmin."}
    v = _vigia(None, avisos, lambda: sem_chave)
    v.sincronizar()
    v.sincronizar()
    assert avisos == [("Falta a chave pessoal do Garmin.", True), ("Falta a chave pessoal do Garmin.", False)]


def test_script_crash_becomes_a_warning() -> None:
    avisos = []

    def quebra():
        raise RuntimeError("uv não encontrado")

    assert _vigia(None, avisos, quebra).sincronizar() is None
    assert avisos == [("Não consegui buscar no Garmin: uv não encontrado", True)]


def test_texts() -> None:
    assert texto_sync({"importadas": 1, "parou": "O Garmin limitou"}) == (
        "1 treino novo do Garmin no Kactus · parou no meio: O Garmin limitou"
    )
    assert texto_sync({"importadas": 0, "erros": 2}) == "Nada novo no Garmin · 2 com erro"
    assert not merece_aviso({"importadas": 0, "duplicadas": 5})
    assert merece_aviso(None)
