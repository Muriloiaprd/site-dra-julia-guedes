"""Mini servidor do controle: pagina, status, comandos e protecao por Origin."""

import json
import socket
import urllib.error
import urllib.request

import pytest

from kactus_controle import web

APP = "https://murilo.exemplo.ts.net"


def porta_livre() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture
def servidor():
    recebidos: list[str] = []

    def comando(acao: str) -> bool:
        recebidos.append(acao)
        return acao in {"ligar", "desligar", "reiniciar", "mostrar"}

    porta = porta_livre()
    srv = web.iniciar(comando, lambda: {"estado": "ligado"}, web.origens_permitidas(APP, porta), porta)
    yield f"http://127.0.0.1:{porta}", recebidos, porta
    srv.shutdown()


def chamar(url: str, metodo: str = "GET", origem: str | None = None, corpo: bytes | None = None):
    headers = {"Origin": origem} if origem else {}
    req = urllib.request.Request(url, data=corpo, method=metodo, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status, dict(r.headers), r.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()


def test_pagina_manifest_e_icone(servidor):
    base, _, _ = servidor
    status, headers, corpo = chamar(base + "/")
    assert status == 200 and "text/html" in headers["Content-Type"]
    assert b"Kactus Controle" in corpo
    status, _, corpo = chamar(base + "/manifest.webmanifest")
    assert status == 200 and json.loads(corpo)["short_name"] == "Controle"
    assert chamar(base + "/icone.png")[0] == 200


def test_status(servidor):
    base, _, _ = servidor
    status, _, corpo = chamar(base + "/api/status")
    assert status == 200 and json.loads(corpo) == {"estado": "ligado"}


@pytest.mark.parametrize("acao", ["ligar", "desligar", "reiniciar"])
def test_comandos_por_post(servidor, acao):
    base, recebidos, _ = servidor
    status, _, corpo = chamar(f"{base}/api/{acao}", "POST")
    assert status == 200 and json.loads(corpo)["ok"]
    assert recebidos == [acao]


def test_comando_por_get_e_recusado(servidor):
    base, recebidos, _ = servidor
    assert chamar(base + "/api/desligar")[0] == 405
    assert recebidos == []


def test_origem_de_fora_e_recusada(servidor):
    base, recebidos, _ = servidor
    status, headers, _ = chamar(base + "/api/desligar", "POST", origem="https://site-qualquer.com")
    assert status == 403
    assert "Access-Control-Allow-Origin" not in headers
    assert recebidos == []


@pytest.mark.parametrize("origem", [APP, f"{APP}:8443"])
def test_origens_do_kactus_aceitas_com_cors(servidor, origem):
    base, recebidos, _ = servidor
    status, headers, _ = chamar(base + "/api/ligar", "POST", origem=origem)
    assert status == 200
    assert headers["Access-Control-Allow-Origin"] == origem
    status, headers, _ = chamar(base + "/api/status", "OPTIONS", origem=origem)
    assert status == 204 and headers["Access-Control-Allow-Origin"] == origem
    assert recebidos == ["ligar"]


def test_trava_de_instancia_unica_e_enviar(servidor):
    _, recebidos, porta = servidor
    with pytest.raises(OSError):
        web.iniciar(lambda a: True, porta=porta)
    assert web.enviar("mostrar", porta)
    assert not web.enviar("qualquer", porta)
    assert recebidos == ["mostrar", "qualquer"]
