"""Metricas derivadas da serie de pontos: cadencia normalizada, GAP estimado e
deriva cardiaca (funcoes puras, sem banco).

Os pontos precisam ter elapsed_time_s; distance_m, altitude_m, hr e cadence
quando disponiveis (serve NormalizedPoint, ActivityPoint ou PointLike).
"""

from statistics import median

# Esportes em que a cadencia e contada em passos. O FIT (e o GPX/TCX exportados
# pela Garmin) grava passadas por minuto de UMA perna so: ~80 numa corrida em
# que o atleta da ~160 passos/min.
STEP_SPORTS = {"run", "trail_run", "treadmill", "walk"}
RUN_SPORTS = {"run", "trail_run", "treadmill"}
# Passos/min reais ficam acima disso tanto andando (~100-120) quanto correndo
# (~150-190); valores por perna ficam abaixo (~50-95). Usado so para decidir se
# um arquivo veio "por perna".
_PER_LEG_CEILING = 120

# Janela minima (em metros) para medir a inclinacao: a altitude do GPS/barometro
# oscila alguns metros, e inclinacao ponto a ponto vira ruido.
_GRADE_WINDOW_M = 50.0
# Raio da media movel aplicada na altitude antes de medir a inclinacao.
_SMOOTH_M = 30.0
# Inclinacoes acima disso sao quase sempre erro de altitude, nao terreno.
_MAX_GRADE = 0.30

# Deriva: ignora o comeco (aquecimento, FC ainda subindo) e exige duracao minima
# para as duas metades terem tamanho util.
_DECOUPLING_MIN_S = 30 * 60
_DECOUPLING_SKIP_S = 5 * 60
# Intervalo maior que isso entre dois pontos = pausa ou perda de sinal.
_MAX_GAP_S = 60


def step_cadence_factor(sport: str, avg_cadence: float | None, point_cadences: list[int | None]) -> int:
    """2 se a cadencia desta atividade veio por perna e precisa ser dobrada, 1 senao."""
    if sport not in STEP_SPORTS:
        return 1
    if avg_cadence:
        reference = float(avg_cadence)
    else:
        positives = [c for c in point_cadences if c]
        if not positives:
            return 1
        reference = median(positives)
    return 2 if reference < _PER_LEG_CEILING else 1


def minetti_cost(grade: float) -> float:
    """Custo energetico da corrida (J/kg/m) na inclinacao `grade` (fracao, 0.05 = 5%).

    Polinomio de Minetti et al. (2002), J Appl Physiol 93:1039-1046. Sabido: em
    descida a curva e metabolica e subestima o custo real (frenagem, tecnica), entao
    o GAP de trechos em descida sai mais lento do que o atleta sente."""
    i = grade
    return 155.4 * i**5 - 30.4 * i**4 - 43.3 * i**3 + 46.3 * i**2 + 19.5 * i + 3.6


_FLAT_COST = minetti_cost(0.0)


def grade_factor(grade: float) -> float:
    """Quanto 1 metro nesta inclinacao 'vale' em metros no plano."""
    g = max(-_MAX_GRADE, min(_MAX_GRADE, grade))
    return minetti_cost(g) / _FLAT_COST


def flat_equivalent(points: list) -> tuple[float, float] | None:
    """(distancia real, distancia equivalente no plano) em metros.

    A inclinacao e medida em janelas de pelo menos _GRADE_WINDOW_M. None se nao
    houver distancia e altitude suficientes."""
    pts = [p for p in points if p.distance_m is not None and p.altitude_m is not None]
    if len(pts) < 2:
        return None
    dist = [float(p.distance_m) for p in pts]
    alt = _smoothed_altitude(dist, [float(p.altitude_m) for p in pts])

    real = flat = 0.0
    start = 0
    for i in range(1, len(pts)):
        d = dist[i] - dist[start]
        if d < _GRADE_WINDOW_M and i != len(pts) - 1:
            continue
        if d > 0:
            real += d
            flat += d * grade_factor((alt[i] - alt[start]) / d)
        start = i
    if real <= 0 or flat <= 0:
        return None
    return real, flat


def _smoothed_altitude(dist: list[float], alt: list[float]) -> list[float]:
    """Media movel da altitude em +-_SMOOTH_M metros. Sem isso, ruido simetrico
    de altitude vira GAP enviesado para cima: a curva de custo e convexa, entao
    subida falsa pesa mais do que a descida falsa desconta."""
    out = []
    lo = hi = 0
    total = 0.0
    for i, d in enumerate(dist):
        while hi < len(dist) and dist[hi] <= d + _SMOOTH_M:
            total += alt[hi]
            hi += 1
        while dist[lo] < d - _SMOOTH_M:
            total -= alt[lo]
            lo += 1
        out.append(total / (hi - lo))
    return out


def gap_pace(pace_s_per_km: float | None, points: list) -> float | None:
    """Ritmo ajustado a inclinacao (s/km): o ritmo real escalado pela razao entre a
    distancia real e a equivalente no plano. Estimativa, nao medida."""
    if not pace_s_per_km:
        return None
    eq = flat_equivalent(points)
    if eq is None:
        return None
    real, flat = eq
    return round(float(pace_s_per_km) * real / flat, 2)


def hr_decoupling_pct(points: list) -> float | None:
    """Deriva cardiaca (desacoplamento ritmo:FC, metodo de Friel), em %.

    Compara a eficiencia (velocidade no plano por batimento) da 1a metade com a
    da 2a. Positivo = na 2a metade o coracao trabalhou mais para o mesmo ritmo.
    Ate ~5% e o normal de um treino aerobico bem dosado."""
    pts = [p for p in points if p.distance_m is not None and p.hr]
    if len(pts) < 4:
        return None
    t0 = pts[0].elapsed_time_s
    if pts[-1].elapsed_time_s - t0 < _DECOUPLING_MIN_S:
        return None

    pts = [p for p in pts if p.elapsed_time_s - t0 >= _DECOUPLING_SKIP_S]
    mid = (pts[0].elapsed_time_s + pts[-1].elapsed_time_s) / 2
    first = _efficiency([p for p in pts if p.elapsed_time_s <= mid])
    second = _efficiency([p for p in pts if p.elapsed_time_s > mid])
    if not first or not second:
        return None
    return round((first - second) / first * 100, 2)


def _efficiency(pts: list) -> float | None:
    """Metros no plano por segundo em movimento, dividido pela FC media ponderada."""
    moving_s = 0.0
    hr_weighted = 0.0
    for a, b in zip(pts, pts[1:]):
        dt = b.elapsed_time_s - a.elapsed_time_s
        if 0 < dt <= _MAX_GAP_S:
            moving_s += dt
            hr_weighted += b.hr * dt
    if moving_s <= 0:
        return None

    eq = flat_equivalent(pts)
    if eq is not None:
        distance = eq[1]
    else:
        distance = float(pts[-1].distance_m) - float(pts[0].distance_m)
    if distance <= 0:
        return None
    return (distance / moving_s) / (hr_weighted / moving_s)
