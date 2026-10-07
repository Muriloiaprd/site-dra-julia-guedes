"""Mini servidor do Kactus Controle em 127.0.0.1:3010.

- Pagina "Kactus Controle" para o iPhone (via `tailscale serve --https=8443`).
- API: GET /api/status, POST /api/ligar|desligar|reiniciar.
- A porta tambem e a trava de instancia unica: abrir o controle de novo so manda
  um comando (POST /api/comando) para o que ja esta rodando.

O Tailscale entrega tudo como se viesse de 127.0.0.1, entao a protecao contra
outra pagina mandando comandos e o cabecalho Origin: so as origens do Kactus.
"""

from __future__ import annotations

import json
import threading
import urllib.request
from collections.abc import Callable, Iterable
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORTA = 3010
PORTA_IPHONE = 8443  # tailscale serve --https=8443
AQUI = Path(__file__).resolve().parent
ICONE = AQUI.parents[1] / "web" / "app" / "apple-icon.png"  # apps/web/app/apple-icon.png
ACOES_API = {"ligar", "desligar", "reiniciar"}


def origens_permitidas(endereco_iphone: str | None, porta: int = PORTA) -> set[str]:
    """O proprio controle (PC e iPhone) e o app do Kactus (tela "Kactus desligado")."""
    origens = {f"http://127.0.0.1:{porta}", f"http://localhost:{porta}"}
    if endereco_iphone:
        origens |= {endereco_iphone, f"{endereco_iphone}:{PORTA_IPHONE}"}
    return origens


class _Servidor(ThreadingHTTPServer):
    # no Windows, SO_REUSEADDR deixa duas instancias ouvirem a mesma porta
    allow_reuse_address = False
    daemon_threads = True


def iniciar(
    comando: Callable[[str], bool],
    status: Callable[[], dict] = dict,
    origens: Iterable[str] = (),
    porta: int = PORTA,
) -> ThreadingHTTPServer:
    """Sobe o servidor numa thread. OSError se a porta ja estiver em uso (outra instancia)."""
    permitidas = set(origens) | origens_permitidas(None, porta)

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):  # sem console
            pass

        # ── respostas ────────────────────────────────────────────────
        def _cors(self) -> None:
            origem = self.headers.get("Origin")
            if origem in permitidas:
                self.send_header("Access-Control-Allow-Origin", origem)
                self.send_header("Vary", "Origin")

        def _enviar(self, status_http: int, dados: bytes, tipo: str, cache: str = "no-store") -> None:
            self.send_response(status_http)
            self.send_header("Content-Type", tipo)
            self.send_header("Content-Length", str(len(dados)))
            self.send_header("Cache-Control", cache)
            self._cors()
            self.end_headers()
            self.wfile.write(dados)

        def _json(self, status_http: int, corpo: dict) -> None:
            self._enviar(status_http, json.dumps(corpo, ensure_ascii=False).encode(), "application/json; charset=utf-8")

        def _origem_ok(self) -> bool:
            origem = self.headers.get("Origin")
            # sem Origin = chamada local (curl, o proprio .exe); com Origin, so as do Kactus
            return origem is None or origem in permitidas

        # ── rotas ────────────────────────────────────────────────────
        def do_OPTIONS(self):  # noqa: N802 - nome exigido pelo http.server
            if not self._origem_ok():
                return self._json(403, {"erro": "origem não permitida"})
            self.send_response(204)
            self._cors()
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Max-Age", "600")
            self.end_headers()

        def do_GET(self):  # noqa: N802
            caminho = self.path.split("?")[0]
            if caminho == "/":
                return self._enviar(200, (AQUI / "pagina.html").read_bytes(), "text/html; charset=utf-8")
            if caminho == "/manifest.webmanifest":
                return self._enviar(200, (AQUI / "manifest.webmanifest").read_bytes(), "application/manifest+json")
            if caminho == "/icone.png" and ICONE.exists():
                return self._enviar(200, ICONE.read_bytes(), "image/png", cache="max-age=86400")
            if caminho == "/api/status":
                return self._json(200, status())
            if caminho.removeprefix("/api/") in ACOES_API:
                return self._json(405, {"erro": "use POST"})
            return self._json(404, {"erro": "não encontrado"})

        def do_POST(self):  # noqa: N802
            if not self._origem_ok():
                return self._json(403, {"erro": "origem não permitida"})
            caminho = self.path.split("?")[0]
            n = int(self.headers.get("Content-Length") or 0)
            corpo = self.rfile.read(n) if n else b""
            if caminho == "/api/comando":
                try:
                    acao = json.loads(corpo or b"{}").get("acao", "")
                except ValueError:
                    return self._json(400, {"erro": "json inválido"})
            elif caminho.removeprefix("/api/") in ACOES_API:
                acao = caminho.removeprefix("/api/")
            else:
                return self._json(404, {"erro": "não encontrado"})
            ok = comando(acao)
            return self._json(200 if ok else 400, {"ok": ok, **(status() if ok else {})})

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
