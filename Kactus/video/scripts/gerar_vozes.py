"""Gera um MP3 por fala com o Edge TTS (grátis) e um índice com duração e tempo de cada palavra.

Rodar de dentro de Kactus/video:
    uv run --with edge-tts --with miniaudio python scripts/gerar_vozes.py          # só as falas novas ou mudadas
    uv run --with edge-tts --with miniaudio python scripts/gerar_vozes.py --tudo   # gera tudo de novo

Além da duração, grava o volume da voz quadro a quadro (30 por segundo): é o que abre e fecha a
boca dos personagens no vídeo.
"""
import asyncio
import hashlib
import json
import sys
from pathlib import Path

import edge_tts
import miniaudio

RAIZ = Path(__file__).resolve().parent.parent
FALAS = RAIZ / "roteiro" / "falas.json"
SAIDA = RAIZ / "public" / "audio"
INDICE = SAIDA / "vozes.json"
FPS = 30


def volume_por_quadro(arquivo: Path) -> tuple[float, list[float]]:
    """Duração real e volume (0..1) de cada quadro, normalizado pelo trecho mais alto da fala."""
    som = miniaudio.decode_file(str(arquivo), output_format=miniaudio.SampleFormat.SIGNED16, nchannels=1)
    amostras = som.samples
    por_quadro = som.sample_rate // FPS
    rms = []
    for i in range(0, len(amostras), por_quadro):
        bloco = amostras[i : i + por_quadro]
        rms.append((sum(a * a for a in bloco) / max(1, len(bloco))) ** 0.5)
    ordenado = sorted(rms)
    teto = ordenado[int(len(ordenado) * 0.95)] or 1
    volume = [round(min(1.0, r / teto), 2) for r in rms]
    return round(len(amostras) / som.sample_rate, 3), volume


async def gerar(texto: str, voz: dict, arquivo: Path) -> list[dict]:
    com = edge_tts.Communicate(texto, voz["voz"], rate=voz["rate"], pitch=voz["pitch"], boundary="WordBoundary")
    palavras = []
    with arquivo.open("wb") as f:
        async for pedaco in com.stream():
            if pedaco["type"] == "audio":
                f.write(pedaco["data"])
            elif pedaco["type"] == "WordBoundary":
                palavras.append(
                    {
                        "inicio": round(pedaco["offset"] / 1e7, 3),
                        "duracao": round(pedaco["duration"] / 1e7, 3),
                        "texto": pedaco["text"],
                    }
                )
    return palavras


async def main() -> None:
    tudo = "--tudo" in sys.argv
    roteiro = json.loads(FALAS.read_text(encoding="utf-8"))
    SAIDA.mkdir(parents=True, exist_ok=True)
    antigo = json.loads(INDICE.read_text(encoding="utf-8")) if INDICE.exists() and not tudo else {}
    indice = {}
    for cena in roteiro["cenas"]:
        for i, fala in enumerate(cena["falas"]):
            chave = f"c{cena['n']:02d}_f{i}"
            voz = roteiro["vozes"][fala["quem"]]
            assinatura = hashlib.sha1(json.dumps([fala["texto"], voz], ensure_ascii=False).encode()).hexdigest()[:12]
            arquivo = SAIDA / f"{chave}.mp3"
            if chave in antigo and antigo[chave]["assinatura"] == assinatura and arquivo.exists() and "volume" in antigo[chave]:
                indice[chave] = antigo[chave]
                continue
            if chave in antigo and antigo[chave]["assinatura"] == assinatura and arquivo.exists():
                palavras = antigo[chave]["palavras"]
            else:
                palavras = await gerar(fala["texto"], voz, arquivo)
            duracao, volume = volume_por_quadro(arquivo)
            indice[chave] = {
                "arquivo": f"audio/{chave}.mp3",
                "quem": fala["quem"],
                "duracao": duracao,
                "palavras": palavras,
                "volume": volume,
                "assinatura": assinatura,
            }
            print(f"{chave}  {duracao:5.2f}s  {fala['texto']}")
    INDICE.write_text(json.dumps(indice, ensure_ascii=False, indent=1), encoding="utf-8")
    total = sum(v["duracao"] for v in indice.values())
    print(f"{len(indice)} falas, {total:.1f}s de voz")


asyncio.run(main())
