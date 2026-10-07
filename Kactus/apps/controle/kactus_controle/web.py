"""Mini servidor do Kactus Controle em 127.0.0.1:3010.

A porta tambem e a trava de instancia unica: abrir o controle de novo so manda
um comando para o que ja esta rodando.
"""

from __future__ import annotations

import json
import threading
import urllib.request
from collections.abc import Callable
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORTA = 3010


class _Servidor(ThreadingHTTPServer):
    # no Windows, SO_REUSEADDR deixa duas instancias ouvirem a mesma porta
    allow_reuse_address = False
    daemon_threads = True


def iniciar(comando: Callable[[str], bool], porta: int = PORTA) -> ThreadingHTTPServer:
    """Sobe o servidor numa thread. OSError se a porta ja estiver em uso (outra instancia)."""

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):  # sem console
            pass

        def _json(self, status: int, corpo: dict) -> None:
            dados = json.dumps(corpo).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(dados)))
            self.end_headers()
            self.wfile.write(dados)

        def do_POST(self):  # noqa: N802 - nome exigido pelo http.server
            if self.path != "/api/comando":
                return self._json(404, {"erro": "não encontrado"})
            try:
                n = int(self.headers.get("Content-Length") or 0)
                acao = json.loads(self.rfile.read(n) or b"{}").get("acao", "")
            except ValueError:
                return self._json(400, {"erro": "json inválido"})
            ok = comando(acao)
            return self._json(200 if ok else 400, {"ok": ok})

    srv = _Servidor(("127.0.0.1", porta), Handler)
    threading.Thread(target=srv.serve_forever, name="kactus-web", daemon=True).start()
    return srv


def enviar(acao: str, porta: int = PORTA) -> bool:
    """Manda um comando para a instancia que ja esta rodando."""
    req = urllib.request.Request(
        f"http://127.0.0.1:{porta}/api/comando",
        data=json.dumps({"acao": acao}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status == 200
    except OSError:
        return False
