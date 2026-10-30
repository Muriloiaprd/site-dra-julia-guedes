"""Sintetiza os efeitos sonoros e a trilha do vídeo, sem baixar nada (só matemática).

Rodar de dentro de Kactus/video:
    python scripts/gerar_efeitos.py

Gera WAV mono 44,1 kHz em public/sfx/. A trilha é um laço de 4 compassos (dó, sol, lá menor, fá)
com violão dedilhado (Karplus-Strong), baixo e chocalho, feito para emendar sem corte.
"""
import math
import random
import struct
import wave
from pathlib import Path

TAXA = 44_100
SAIDA = Path(__file__).resolve().parent.parent / "public" / "sfx"
random.seed(7)


def gravar(nome: str, amostras: list[float], pico: float = 0.9) -> None:
    maior = max(1e-9, max(abs(a) for a in amostras))
    fator = pico / maior
    with wave.open(str(SAIDA / f"{nome}.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(TAXA)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, a * fator)) * 32767)) for a in amostras))
    print(f"{nome}.wav  {len(amostras) / TAXA:.2f}s")


def n(seg: float) -> int:
    return int(seg * TAXA)


def varredura(f0: float, f1: float, seg: float, forma=math.sin, exp=True) -> list[float]:
    """Tom que desliza de f0 para f1 (exponencial ou linear)."""
    out, fase, total = [], 0.0, n(seg)
    for i in range(total):
        t = i / total
        f = f0 * (f1 / f0) ** t if exp else f0 + (f1 - f0) * t
        fase += 2 * math.pi * f / TAXA
        out.append(forma(fase))
    return out


def envelope(amostras: list[float], ataque: float = 0.005, queda: float = 6.0) -> list[float]:
    """Ataque linear curto e decaimento exponencial (queda maior = some mais rápido)."""
    a = max(1, n(ataque))
    total = len(amostras)
    return [s * min(1, i / a) * math.exp(-queda * i / total) for i, s in enumerate(amostras)]


def ruido(seg: float) -> list[float]:
    return [random.uniform(-1, 1) for _ in range(n(seg))]


def passa_baixa(amostras: list[float], corte) -> list[float]:
    """Filtro de um polo; `corte` pode ser número (Hz) ou função de 0..1 → Hz."""
    out, y, total = [], 0.0, len(amostras)
    for i, x in enumerate(amostras):
        fc = corte(i / total) if callable(corte) else corte
        a = 1 - math.exp(-2 * math.pi * fc / TAXA)
        y += a * (x - y)
        out.append(y)
    return out


def quadrada(fase: float) -> float:
    return 0.6 if math.sin(fase) >= 0 else -0.6


def triangulo(fase: float) -> float:
    return 2 / math.pi * math.asin(math.sin(fase))


def somar(*faixas: list[float]) -> list[float]:
    total = max(len(f) for f in faixas)
    return [sum(f[i] for f in faixas if i < len(f)) for i in range(total)]


def silencio(seg: float) -> list[float]:
    return [0.0] * n(seg)


def efeitos() -> None:
    gravar("pop", envelope(varredura(900, 280, 0.09), queda=5))
    boing = []
    fase = 0.0
    for i in range(n(0.5)):
        t = i / n(0.5)
        f = (220 + 300 * t) * (1 + 0.3 * math.sin(2 * math.pi * 16 * i / TAXA))
        fase += 2 * math.pi * f / TAXA
        boing.append(triangulo(fase))
    gravar("boing", envelope(boing, queda=4))
    whoosh = passa_baixa(ruido(0.4), lambda t: 300 + 3500 * math.sin(math.pi * t))
    gravar("whoosh", [s * math.sin(math.pi * i / len(whoosh)) for i, s in enumerate(whoosh)])
    gravar("queda", somar(envelope(varredura(120, 45, 0.3), queda=7), envelope(passa_baixa(ruido(0.12), 500), queda=10)))
    gravar("gota", envelope(varredura(900, 2400, 0.07), queda=4))
    fogo = [s * 0.25 for s in passa_baixa(ruido(1.4), 900)]
    for _ in range(40):
        p = random.randint(0, len(fogo) - 400)
        for k, s in enumerate(envelope(ruido(0.006), queda=8)):
            fogo[p + k] += s
    gravar("fogo", fogo, pico=0.7)
    gravar("clique", somar(envelope(ruido(0.004), queda=5), envelope(varredura(3200, 2600, 0.015), queda=6)))
    liga = []
    for f in (523.25, 659.25, 783.99, 1046.5):
        liga += envelope(varredura(f, f, 0.08, quadrada), queda=3)
    gravar("liga", liga + silencio(0.1), pico=0.7)
    toing = []
    for i in range(n(0.6)):
        t = i / TAXA
        vib = 1 + 0.05 * math.sin(2 * math.pi * 11 * t)
        toing.append(sum(a * math.sin(2 * math.pi * 620 * r * vib * t) for r, a in ((1, 1), (2.76, 0.5), (5.4, 0.25))))
    gravar("toing", envelope(toing, queda=5))
    plim = []
    for i in range(n(0.8)):
        t = i / TAXA
        plim.append(sum(a * math.exp(-d * t) * math.sin(2 * math.pi * 1318.5 * r * t) for r, a, d in ((1, 1, 5), (2.0, 0.5, 7), (3.01, 0.3, 9), (4.2, 0.2, 12))))
    gravar("plim", envelope(plim, ataque=0.002, queda=0.5))
    palmas = silencio(2.4)
    for _ in range(110):
        p = random.randint(0, len(palmas) - n(0.03))
        for k, s in enumerate(envelope(passa_baixa(ruido(0.03), random.uniform(1500, 4000)), ataque=0.001, queda=9)):
            palmas[p + k] += s * random.uniform(0.4, 1)
    gravar("aplausos", [s * min(1, (len(palmas) - i) / n(0.8)) for i, s in enumerate(palmas)], pico=0.6)
    sobe = varredura(260, 1100, 1.6, quadrada)
    gravar("sobe", [s * (0.55 + 0.45 * math.sin(2 * math.pi * 14 * i / TAXA)) for i, s in enumerate(sobe)], pico=0.5)
    alarme = []
    for k in range(4):
        alarme += envelope(varredura(880 if k % 2 == 0 else 660, 880 if k % 2 == 0 else 660, 0.2, quadrada), queda=1)
    gravar("alarme", alarme, pico=0.6)


def trilha() -> None:
    """Laço de 4 compassos a 110 bpm. As notas que passam do fim voltam para o começo (emenda sem corte)."""
    batida = 60 / 110
    total = n(batida * 16)
    faixa = [0.0] * total

    def por(inicio: float, amostras: list[float], vol: float) -> None:
        p = n(inicio)
        for k, s in enumerate(amostras):
            faixa[(p + k) % total] += s * vol

    def corda(freq: float, seg: float) -> list[float]:
        periodo = max(2, int(TAXA / freq))
        buf = [random.uniform(-1, 1) for _ in range(periodo)]
        out = []
        for i in range(n(seg)):
            s = buf[i % periodo]
            buf[i % periodo] = 0.996 * 0.5 * (s + buf[(i + 1) % periodo])
            out.append(s)
        return out

    notas = {"C": 261.63, "E": 329.63, "G": 392.0, "B": 493.88, "D": 293.66, "A": 220.0, "F": 174.61}
    acordes = [("C", ["C", "E", "G", "E"]), ("G", ["G", "B", "D", "B"]), ("A", ["A", "C", "E", "C"]), ("F", ["F", "A", "C", "A"])]
    graves = {"C": 65.41, "G": 98.0, "A": 55.0, "F": 87.31}
    for c, (raiz, arpejo) in enumerate(acordes):
        compasso = c * 4 * batida
        for k in range(8):
            nota = arpejo[k % 4]
            freq = notas[nota] * (2 if k % 4 == 2 else 1)
            por(compasso + k * batida / 2, corda(freq, 0.9), 0.35)
        for b in (0, 2):
            por(compasso + b * batida, envelope(varredura(graves[raiz], graves[raiz], 0.5), queda=5), 0.5)
        for k in range(8):
            if k % 2 == 1:
                por(compasso + k * batida / 2, envelope(passa_baixa(ruido(0.05), 6000), ataque=0.001, queda=8), 0.08)
    gravar("trilha", faixa, pico=0.8)


if __name__ == "__main__":
    SAIDA.mkdir(parents=True, exist_ok=True)
    efeitos()
    trilha()
