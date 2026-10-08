"""Leitura do estado do Tailscale (sem rodar o tailscale.exe)."""

import json

from kactus_controle.tailscale import avaliar

RODANDO = json.dumps({"BackendState": "Running"})
SERVE_OK = json.dumps({"TCP": {"443": {"HTTPS": True}, "8443": {"HTTPS": True}}})


def test_tudo_certo():
    assert avaliar(RODANDO, SERVE_OK).ok


def test_app_fechado_deixa_o_servico_parado():
    e = avaliar(json.dumps({"BackendState": "NoState"}), json.dumps({}))
    assert not e.ok and e.motivo == "parado"


def test_sem_resposta_conta_como_parado():
    assert avaliar(None, None).motivo == "parado"
    assert avaliar("lixo", "lixo").motivo == "parado"


def test_falta_um_endereco():
    so_app = json.dumps({"TCP": {"443": {"HTTPS": True}}})
    e = avaliar(RODANDO, so_app)
    assert not e.ok and e.motivo == "sem_endereco"
    assert avaliar(RODANDO, "{}").motivo == "sem_endereco"
    assert avaliar(RODANDO, "").motivo == "sem_endereco"
