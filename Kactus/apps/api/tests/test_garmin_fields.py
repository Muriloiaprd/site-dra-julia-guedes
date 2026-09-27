"""Dados do FIT do Garmin (migration 018): leitura do resumo, rotulos, tempo
andando e o que chega na API. Sem FIT real no repo (tem nome, peso e rota do
atleta): as mensagens sao simuladas."""

import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from kactus_api.metrics.garmin import (
    benefit_label,
    compute_walk_time_s,
    feeling_from_watch,
    rpe_from_watch,
)
from kactus_api.models import Activity, User
from kactus_api.parsers import fit
from kactus_api.parsers.base import NormalizedActivity, NormalizedPoint
from kactus_api.security import hash_password
from kactus_api.services.import_service import _derive_summary, garmin_fields, import_activity


class _Msg:
    """Imita o DataMessage do fitparse: get_value por nome ou por numero."""

    def __init__(self, values: dict):
        self.values = values

    def get_value(self, key):
        return self.values.get(key)


# os valores da corrida de 2026-09-26 (5,01 km) conferida contra o Garmin Connect
_SESSION = {
    "total_timer_time": 1679.284, "total_distance": 5008.37, "avg_heart_rate": 172, "max_heart_rate": 189,
    "avg_cadence": 85, "avg_fractional_cadence": 0.625, "total_calories": 383,
    "enhanced_max_speed": 3.695, "normalized_power": 299, "avg_temperature": 29, "max_temperature": 31,
    "total_training_effect": 3.9, "total_anaerobic_training_effect": 0.0,
    "avg_vertical_oscillation": 87.7, "avg_stance_time": 260.0, "avg_vertical_ratio": 8.48,
    "avg_step_length": 1037.2, "total_strides": 2393,
    150: 27, 178: 466, 188: 5, 192: 0, 193: 100, 196: 40, 202: 37,
}


def _norm(**over) -> NormalizedActivity:
    base = {"sport": "run", "start_time": datetime(2026, 9, 26, 12, 34, tzinfo=UTC), "duration_s": 1752, "source": "fit"}
    return NormalizedActivity(**{**base, **over})


def test_session_fields_match_garmin_connect() -> None:
    act = _norm()
    fit._fill_from_session(act, _Msg(_SESSION))

    assert act.avg_cadence == 85.625  # por perna; o import dobra para 171
    assert act.max_speed_ms == 3.695 and act.normalized_power_w == 299
    assert (act.min_temperature_c, act.max_temperature_c) == (27.0, 31.0)
    assert (act.training_effect_aerobic, act.training_effect_anaerobic) == (3.9, 0.0)
    assert act.primary_benefit == 5 and benefit_label(act.primary_benefit) == "VO2 máx"
    assert (act.sweat_loss_ml, act.resting_calories, act.hr_recovery) == (466, 40, 37)
    assert act.avg_step_length_mm == 1037.2 and act.avg_stance_time_ms == 260.0
    assert (act.watch_feel, act.watch_rpe) == (0, 100)


def test_zero_means_not_measured() -> None:
    act = _norm()
    fit._fill_from_session(act, _Msg({**_SESSION, 202: 0, "avg_stance_time": 0, 193: 255}))
    assert act.hr_recovery is None and act.avg_stance_time_ms is None
    assert act.watch_rpe is None  # fora de 0-100 = invalido


def test_watch_self_evaluation_mapping() -> None:
    assert feeling_from_watch(0) == "sem_energia" and feeling_from_watch(100) == "otimo"
    assert feeling_from_watch(60) == "normal"  # arredonda para o degrau mais perto
    assert rpe_from_watch(100) == 10 and rpe_from_watch(30) == 3 and rpe_from_watch(None) is None


def _run_points(walk_from: int) -> list[NormalizedPoint]:
    """1 ponto/s a 3 m/s; a partir de `walk_from` s, cadencia de caminhada."""
    return [
        NormalizedPoint(
            elapsed_time_s=t, distance_m=3.0 * t, speed_ms=3.0, cadence=85 if t < walk_from else 60,
            altitude_m=170 + (t % 20), temperature_c=27 + (t % 3),
            step_length_mm=1040, stance_time_ms=258,
        )
        for t in range(0, 300)
    ]


def test_walk_time_and_extremes() -> None:
    pts = _run_points(walk_from=280)
    # 20 s andando (cadencia 120 passos/min); o resto correndo a 170
    assert compute_walk_time_s(pts, "run", 85.0) == 20
    assert compute_walk_time_s([NormalizedPoint(elapsed_time_s=0)], "run", None) is None

    norm = _norm(points=pts, avg_cadence=85.0)
    _derive_summary(norm)
    assert (norm.elevation_min_m, norm.elevation_max_m) == (170.0, 189.0)
    assert (norm.min_temperature_c, norm.max_temperature_c) == (27.0, 29.0)
    assert norm.avg_temperature_c == 28.0
    assert garmin_fields(norm)["walk_time_s"] == 20


def test_import_saves_garmin_fields_and_api_returns_them(auth_client, db_session: Session) -> None:
    client, user = auth_client
    norm = _norm(points=_run_points(walk_from=290), duration_s=300)
    fit._fill_from_session(norm, _Msg(_SESSION))
    result = import_activity(db_session, user["id"], norm, recompute_metrics=False)

    body = client.get(f"/activities/{result.activity_id}").json()
    assert body["avg_cadence"] == 171.25
    assert body["max_speed_kmh"] == 13.3
    assert body["training_effect_aerobic"] == 3.9 and body["primary_benefit_label"] == "VO2 máx"
    assert body["avg_step_length_m"] == 1.04 and body["sweat_loss_ml"] == 466
    assert body["watch_feel"] == 0 and body["watch_rpe"] == 100
    # a autoavaliacao do relogio NAO vira check-in sozinha
    assert body["rpe"] is None and body["checkin_at"] is None
    assert body["points"][0]["step_length_mm"] == 1040 and body["points"][0]["stance_time_ms"] == 258


def test_new_columns_default_to_null(db_session: Session) -> None:
    """Sanidade do modelo: colunas novas nulas por padrao."""
    user = User(email=f"pytest-{uuid.uuid4().hex[:12]}@kactus.test", password_hash=hash_password("senha-123456"))
    db_session.add(user)
    db_session.flush()
    act = Activity(user_id=user.id, sport="run", start_time=datetime(2026, 9, 1, tzinfo=UTC), duration_s=60, source="gpx")
    db_session.add(act)
    db_session.flush()
    assert act.training_effect_aerobic is None and act.primary_benefit_label is None
    db_session.rollback()


def test_duni_gets_watch_data() -> None:
    from kactus_api.ai.coach_service import _activity_detail, _watch_detail

    act = Activity(
        sport="run", start_time=datetime(2026, 9, 26, 12, tzinfo=UTC), duration_s=1752, moving_time_s=1679,
        training_effect_aerobic=3.9, training_effect_anaerobic=0.0, primary_benefit=5,
        avg_step_length_m=1.04, avg_vertical_oscillation_mm=87.7, avg_stance_time_ms=260.0,
        min_temperature_c=27, max_temperature_c=31, sweat_loss_ml=466, walk_time_s=12,
    )
    watch = _watch_detail(act)
    assert watch["efeito_treino"] == {"aerobico": 3.9, "anaerobico": 0.0, "beneficio": "VO2 máx"}
    assert watch["dinamica_de_corrida"]["oscilacao_vertical_cm"] == 8.8
    assert watch["temperatura_min_max_c"] == [27.0, 31.0] and watch["minutos_andando"] == 0.2
    brief = _activity_detail(act)
    assert brief["efeito_aerobico"] == 3.9 and brief["beneficio"] == "VO2 máx"
    # sem dado do relogio, nada extra no contexto
    assert _watch_detail(Activity(sport="run", start_time=act.start_time, duration_s=60)) == {}
