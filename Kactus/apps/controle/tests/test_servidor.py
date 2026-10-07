"""Ciclo de vida do servidor com comandos falsos: um http.server no lugar do pnpm."""

import socket
import subprocess
import sys
import time

import pytest

from kactus_controle.servidor import Comandos, Estado, Servidor, responde

PY = sys.executable


def porta_livre() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def fake_server(porta: int) -> list[str]:
    return [PY, "-m", "http.server", str(porta), "--bind", "127.0.0.1"]


def py(codigo: str) -> list[str]:
    return [PY, "-c", codigo]


def rodar_ate(s: Servidor, cond, timeout: float = 20.0) -> None:
    """Gira a vigia na mao ate a condicao valer."""
    fim = time.time() + timeout
    while time.time() < fim:
        s._passo()
        if cond():
            return
        time.sleep(0.1)
    raise AssertionError(f"timeout; estado={s.info}")


@pytest.fixture
def porta():
    return porta_livre()


def criar(tmp_path, porta, comandos: Comandos, eventos=None, **kw) -> Servidor:
    kw.setdefault("espera_religar", 0.1)
    return Servidor(
        raiz=tmp_path,
        comandos=comandos,
        checar=lambda: responde(f"http://127.0.0.1:{porta}/", 0.5),
        portas=(porta,),
        matar_lancadores=lambda: None,  # nunca encostar no Kactus de verdade
        log=tmp_path / "logs" / "servidor.log",
        ao_mudar=(lambda info, ev: eventos.append(ev)) if eventos is not None else None,
        **kw,
    )


def test_liga_e_desliga_no_modo_dev(tmp_path, porta):
    eventos: list = []
    s = criar(
        tmp_path, porta, Comandos(rapido=py("raise SystemExit(9)"), dev=fake_server(porta), build=py("")), eventos
    )
    s.ligar("dev")
    rodar_ate(s, lambda: s.estado == Estado.LIGADO)
    assert s.info.modo_atual == "dev"
    assert s.info.desde is not None
    assert "ligado" in eventos

    s.desligar()
    assert s.estado == Estado.DESLIGADO
    assert not responde(f"http://127.0.0.1:{porta}/", 0.5)
    assert "desligado" in eventos
    assert (tmp_path / "logs" / "servidor.log").exists()


def test_modo_rapido_faz_build_quando_precisa(tmp_path, porta):
    marca = tmp_path / "buildou"
    s = criar(
        tmp_path,
        porta,
        Comandos(
            rapido=fake_server(porta),
            dev=py("raise SystemExit(9)"),
            build=py(f"open(r'{marca}', 'w').close()"),
            precisa_build=py("raise SystemExit(1)"),
        ),
    )
    s.ligar("rapido")
    rodar_ate(s, lambda: s.estado == Estado.LIGADO)
    assert marca.exists()
    assert s.info.modo_atual == "rapido"
    s.desligar()


def test_build_em_dia_nao_refaz(tmp_path, porta):
    marca = tmp_path / "buildou"
    s = criar(
        tmp_path,
        porta,
        Comandos(
            rapido=fake_server(porta),
            dev=py("raise SystemExit(9)"),
            build=py(f"open(r'{marca}', 'w').close()"),
            precisa_build=py("raise SystemExit(0)"),
        ),
    )
    s.ligar("rapido")
    rodar_ate(s, lambda: s.estado == Estado.LIGADO)
    assert not marca.exists()
    s.desligar()


def test_build_que_falha_cai_para_o_modo_dev(tmp_path, porta):
    s = criar(
        tmp_path,
        porta,
        Comandos(
            rapido=py("raise SystemExit(9)"),
            dev=fake_server(porta),
            build=py("raise SystemExit(1)"),
            precisa_build=py("raise SystemExit(1)"),
        ),
    )
    s.ligar("rapido")
    rodar_ate(s, lambda: s.estado == Estado.LIGADO)
    assert s.info.modo_atual == "dev"
    assert s.info.modo == "rapido"  # a preferencia nao muda por causa de uma falha
    s.desligar()


def test_religa_sozinho_quando_cai(tmp_path, porta):
    eventos: list = []
    s = criar(tmp_path, porta, Comandos(rapido=py(""), dev=fake_server(porta), build=py("")), eventos)
    s.ligar("dev")
    rodar_ate(s, lambda: s.estado == Estado.LIGADO)
    primeiro = s._proc
    primeiro.kill()
    primeiro.wait()

    rodar_ate(s, lambda: "caiu" in eventos)
    rodar_ate(s, lambda: s.estado == Estado.LIGADO and s._proc is not None and s._proc is not primeiro)
    s.desligar()


def test_nao_religa_depois_de_desligar(tmp_path, porta):
    s = criar(tmp_path, porta, Comandos(rapido=py(""), dev=fake_server(porta), build=py("")))
    s.ligar("dev")
    rodar_ate(s, lambda: s.estado == Estado.LIGADO)
    s.desligar()
    for _ in range(5):
        s._passo()
        time.sleep(0.15)
    assert s.estado == Estado.DESLIGADO
    assert s._proc is None
    assert not responde(f"http://127.0.0.1:{porta}/", 0.5)


def test_desiste_depois_de_cair_demais(tmp_path, porta):
    eventos: list = []
    s = criar(
        tmp_path,
        porta,
        Comandos(rapido=py("raise SystemExit(1)"), dev=py("raise SystemExit(1)"), build=py("")),
        eventos,
        limite_quedas=3,
        espera_religar=0.05,
    )
    s.ligar("dev")
    rodar_ate(s, lambda: s.estado == Estado.ERRO)
    assert "erro" in eventos
    # bloqueado: a vigia nao tenta de novo
    for _ in range(5):
        s._passo()
        time.sleep(0.1)
    assert s.estado == Estado.ERRO
    assert s._proc is None

    # um novo Ligar destrava
    s.comandos.dev = fake_server(porta)
    s.ligar("dev")
    rodar_ate(s, lambda: s.estado == Estado.LIGADO)
    s.desligar()


def test_adota_e_desliga_servidor_aberto_por_fora(tmp_path, porta):
    de_fora = subprocess.Popen(fake_server(porta), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        s = criar(tmp_path, porta, Comandos(rapido=py(""), dev=py(""), build=py("")))
        rodar_ate(s, lambda: s.estado == Estado.LIGADO)
        assert s.info.externo

        s.desligar()
        de_fora.wait(timeout=10)
        assert s.estado == Estado.DESLIGADO
    finally:
        if de_fora.poll() is None:
            de_fora.kill()


def test_ligar_com_servidor_de_fora_adota_em_vez_de_subir_outro(tmp_path, porta):
    de_fora = subprocess.Popen(fake_server(porta), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        rodar_ate_responder = time.time() + 10
        while not responde(f"http://127.0.0.1:{porta}/", 0.5) and time.time() < rodar_ate_responder:
            time.sleep(0.1)
        marca = tmp_path / "subiu"
        s = criar(tmp_path, porta, Comandos(rapido=py(f"open(r'{marca}', 'w').close()"), dev=py(""), build=py("")))
        s.ligar("dev")
        rodar_ate(s, lambda: s.estado == Estado.LIGADO and not s._iniciando)
        assert s.info.externo
        assert not marca.exists()
        s.desligar()
    finally:
        if de_fora.poll() is None:
            de_fora.kill()
