"""Dados que vem do relogio Garmin (FIT): rotulos e estimativas feitas a partir
deles. Os valores em si sao lidos em parsers/fit.py."""

from kactus_api.metrics.derived import step_cadence_factor

# "Principal beneficio" do treino no Garmin Connect. Conferido em 2026-09-27
# contra 70 arquivos: 0 em caminhada, 1-2 em treino leve, 3-4 em ritmo forte,
# 5 no 5 km forte do print do usuario (VO2 max), 6 em treino de forca curto.
PRIMARY_BENEFIT: dict[int, str] = {
    0: "Nenhum benefício",
    1: "Recuperação",
    2: "Base",
    3: "Ritmo (tempo)",
    4: "Limiar",
    5: "VO2 máx",
    6: "Anaeróbico",
    7: "Sprint",
}

# Sensacao do relogio (0-100, de 25 em 25) -> sensacao do check-in do Kactus
WATCH_FEEL_TO_FEELING: dict[int, str] = {
    100: "otimo",
    75: "bem",
    50: "normal",
    25: "cansado",
    0: "sem_energia",
}

# Abaixo disso (passos/min) o atleta esta andando, nao correndo
_WALK_CADENCE_SPM = 140
_MIN_MOVING_SPEED_MS = 0.5
_MAX_GAP_S = 30


def benefit_label(code: int | None) -> str | None:
    return PRIMARY_BENEFIT.get(code) if code is not None else None


def feeling_from_watch(feel: int | None) -> str | None:
    """Sensacao do relogio arredondada para o degrau mais perto."""
    if feel is None:
        return None
    return WATCH_FEEL_TO_FEELING[min(WATCH_FEEL_TO_FEELING, key=lambda k: abs(k - feel))]


def rpe_from_watch(rpe: int | None) -> int | None:
    """Esforco do relogio (0-100) -> PSE 0-10."""
    return round(rpe / 10) if rpe is not None else None


def compute_walk_time_s(points, sport: str, avg_cadence: float | None) -> int | None:
    """Tempo andando dentro de uma corrida (estimado): trechos em movimento com
    cadencia abaixo de 140 passos/min. None sem cadencia nos pontos."""
    cadences = [p.cadence for p in points]
    if not any(cadences):
        return None
    factor = step_cadence_factor(sport, avg_cadence, cadences)
    walk = 0
    for a, b in zip(points, points[1:], strict=False):
        dt = b.elapsed_time_s - a.elapsed_time_s
        if dt <= 0 or dt > _MAX_GAP_S or not b.cadence:
            continue
        speed = b.speed_ms
        if speed is None and a.distance_m is not None and b.distance_m is not None:
            speed = (b.distance_m - a.distance_m) / dt
        if speed is None or speed < _MIN_MOVING_SPEED_MS:
            continue
        if b.cadence * factor < _WALK_CADENCE_SPM:
            walk += dt
    return walk
