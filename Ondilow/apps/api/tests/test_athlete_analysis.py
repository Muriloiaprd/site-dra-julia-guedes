import uuid
from datetime import date, timedelta
from types import SimpleNamespace

import pytest

from ondilow_api.ai.athlete_analysis import ActSummary, analyze, effective_kind
from ondilow_api.metrics.load import _compute_acwr
from ondilow_api.metrics.predictions import training_recommendation

TODAY = date(2026, 6, 30)


def act(days_ago: int, sport: str = "run", *, km: float = 8.0, pace: float = 330.0, hr: int | None = 145, **kw) -> ActSummary:
    """Atividade `days_ago` dias antes de TODAY. Por padrao: corrida de 8 km a 5:30."""
    duration = kw.pop("duration_s", int(km * pace) if km else 3600)
    return ActSummary(
        id=uuid.uuid4(),
        day=TODAY - timedelta(days=days_ago),
        sport=sport,
        duration_s=duration,
        moving_s=duration,
        distance_m=km * 1000 if km else None,
        elevation_gain_m=kw.pop("elev", 20.0),
        avg_hr=hr,
        pace_s_per_km=pace if km else None,
        tss=kw.pop("tss", 50.0),
        **kw,
    )


def codes(result: dict) -> dict[str, dict]:
    return {s["codigo"]: s for s in result["sinais_de_fadiga"]}


# ── classificacao ───────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("sport", "pace", "expected"),
    [
        ("run", 330, "run"),
        ("run", 600, "walk"),       # "corrida" a 10:00/km e caminhada
        ("treadmill", 400, "run"),
        ("walk", 700, "walk"),
        ("mtb", None, "bike"),
        ("strength", None, "strength"),
        ("pilates", None, "pilates"),
        ("other", None, "other"),
    ],
)
def test_effective_kind(sport, pace, expected):
    assert effective_kind(sport, pace) == expected


# ── janelas e tendencia ──────────────────────────────────────────────────────


def test_windows_split_run_walk_and_complementary():
    acts = [
        act(0, km=10, pace=330),
        act(2, km=20, pace=360),
        act(3, km=4, pace=600),                     # caminhada disfarcada de corrida
        act(4, "strength", km=0, duration_s=2700),
        act(10, km=12, pace=330),                   # fora da janela de 7 dias
    ]
    w7 = analyze(acts, TODAY)["janelas"]["7d"]

    assert w7["corrida"]["sessoes"] == 2
    assert w7["corrida"]["km"] == 30.0
    assert w7["corrida"]["longao_km"] == 20.0
    assert w7["corrida"]["ritmo_medio"] == "5:50/km"  # (10*330 + 20*360) / 30 km
    assert w7["caminhada"] == {"sessoes": 1, "km": 4.0, "minutos": 40}
    assert w7["complementar"] == {"strength": {"sessoes": 1, "minutos": 45}}
    assert w7["dias_com_treino"] == 4
    assert w7["dias_sem_treino"] == 3


def test_future_activities_are_ignored():
    result = analyze([act(1), act(-3, km=30)], TODAY)
    assert result["janelas"]["28d"]["corrida"]["km"] == 8.0


def test_weekly_trend_has_eight_weeks_ending_this_week():
    trend = analyze([act(0), act(8)], TODAY)["tendencia_semanal"]
    assert len(trend) == 8
    assert trend[-1]["em_andamento"] is True
    assert trend[-1]["semana"] == (TODAY - timedelta(days=TODAY.weekday())).isoformat()
    assert sum(w["corrida_sessoes"] for w in trend) == 2


def test_srpe_and_rpe_summary():
    acts = [act(1, rpe=4, srpe=176.0), act(3, rpe=6, srpe=264.0), act(5)]
    w7 = analyze(acts, TODAY)["janelas"]["7d"]
    assert w7["carga_interna_srpe"] == 440
    assert w7["pse_media"] == 5.0
    assert w7["atividades_com_pse"] == "2 de 3"


def test_intensity_distribution_uses_zone_minutes():
    acts = [act(1, easy_min=40, moderate_min=5, hard_min=5), act(3, easy_min=30, moderate_min=10, hard_min=10)]
    dist = analyze(acts, TODAY)["distribuicao_intensidade_28d"]
    assert dist["percentual"] == {"leve_z1_z2": 70, "moderado_z3": 15, "forte_z4_z5": 15}


def test_intensity_distribution_unavailable_without_hr():
    assert analyze([act(1)], TODAY)["distribuicao_intensidade_28d"]["disponivel"] is False


# ── cobertura ──────────────────────────────────────────────────────────────


def test_coverage_reports_gaps_and_warns_about_silence():
    cov = analyze([act(40), act(20)], TODAY)["cobertura_de_dados"]
    assert cov["dias_desde_a_ultima"] == 20
    assert {"de": (TODAY - timedelta(days=39)).isoformat(), "ate": (TODAY - timedelta(days=21)).isoformat(), "dias": 19} in cov["buracos_ultimas_8_semanas"]
    # o silencio ate hoje tambem e um buraco
    assert cov["buracos_ultimas_8_semanas"][-1]["ate"] == TODAY.isoformat()
    assert "pergunte antes de concluir" in cov["aviso"]
    assert "sono" in cov["dados_indisponiveis"]


def test_coverage_counts_runs_treated_as_walks():
    cov = analyze([act(2, pace=620), act(1)], TODAY)["cobertura_de_dados"]
    assert cov["corridas_contadas_como_caminhada_90d"] == 1
    assert "aviso" not in cov


def test_coverage_without_activities():
    assert analyze([], TODAY)["cobertura_de_dados"]["tem_atividades"] is False


# ── sinais de fadiga ────────────────────────────────────────────────────────


def test_efficiency_drop_becomes_trend_with_two_runs():
    baseline = [act(d, pace=330, hr=145) for d in (20, 25, 30, 35)]
    recent = [act(2, pace=330, hr=160), act(5, pace=330, hr=158)]  # mesmo ritmo, FC ~10% maior
    sig = codes(analyze(baseline + recent, TODAY))["eficiencia_caindo"]
    assert sig["tipo"] == "tendencia"
    assert sig["ocorrencias"] == 2


def test_single_bad_run_is_isolated_signal():
    baseline = [act(d, pace=330, hr=145) for d in (20, 25, 30, 35)]
    sig = codes(analyze(baseline + [act(2, hr=162), act(4, hr=146)], TODAY))["eficiencia_caindo"]
    assert sig["tipo"] == "isolado"


def test_no_efficiency_signal_without_baseline():
    assert "eficiencia_caindo" not in codes(analyze([act(2, hr=170)], TODAY))


def test_high_decoupling_signal():
    sig = codes(analyze([act(3, decoupling_pct=8.2), act(20, decoupling_pct=2.0)], TODAY))["deriva_alta"]
    assert sig["tipo"] == "isolado"
    assert "+8.2%" in sig["evidencia"] and "habitual 2.0%" in sig["evidencia"]


def test_unusual_cadence_for_the_same_pace():
    baseline = [act(d, pace=330, cadence=172) for d in (20, 30, 40)]
    sig = codes(analyze(baseline + [act(2, pace=335, cadence=156)], TODAY))["cadencia_incomum"]
    assert "156 ppm (habitual 172)" in sig["evidencia"]


def test_high_rpe_on_easy_run():
    easy = act(2, rpe=7, easy_min=40, moderate_min=3, hard_min=0)
    hard = act(4, rpe=8, easy_min=10, moderate_min=10, hard_min=20)  # PSE alta e esperada
    sig = codes(analyze([easy, hard], TODAY))["pse_alta_em_treino_leve"]
    assert sig["ocorrencias"] == 1


def test_load_jump_needs_a_real_base():
    base = [act(d, tss=100) for d in (8, 12, 16, 20, 24)]      # ~167 TSS/semana
    jump = [act(d, tss=150) for d in (0, 2, 4)]                # 450 na semana
    assert "salto_de_carga" in codes(analyze(base + jump, TODAY))
    # sem base, voltar a treinar nao e "salto"
    assert "salto_de_carga" not in codes(analyze(jump, TODAY))


def test_no_rest_days_streak():
    acts = [act(d, km=5) for d in range(7)]
    assert codes(analyze(acts, TODAY))["sem_descanso"]["evidencia"].startswith("7 dias")
    assert "sem_descanso" not in codes(analyze([act(d) for d in (0, 1, 2, 4, 5, 6)], TODAY))


def test_pain_same_spot_twice_is_trend():
    acts = [
        act(1, pain_level=4, pain_location="Panturrilha"),
        act(5, pain_level=3, pain_location="panturrilha"),
        act(7, pain_level=2, pain_location="joelho"),  # abaixo de 3 nao conta
    ]
    sig = codes(analyze(acts, TODAY))["dor_relatada"]
    assert sig["tipo"] == "tendencia"
    assert "joelho" not in sig["evidencia"]


def test_bad_feelings_signal():
    sig = codes(analyze([act(1, feeling="pernas_pesadas"), act(3, feeling="bem")], TODAY))["sensacao_ruim"]
    assert sig["ocorrencias"] == 1


# ── sessoes equivalentes e cadencia ────────────────────────────────────────────


def test_equivalent_session_more_efficient():
    old = act(60, km=10, pace=340, hr=155, elev=30)
    new = act(3, km=10.3, pace=330, hr=150, elev=35)
    (eq,) = analyze([old, new], TODAY)["sessoes_equivalentes"]
    assert eq["veredito"] == "mais_eficiente"
    assert eq["diferenca_ritmo_s_km"] == -10
    assert eq["diferenca_fc"] == -5


def test_equivalent_session_ignores_different_terrain_and_distance():
    flat_old = act(60, km=10, elev=10)
    hilly_new = act(3, km=10, elev=300)   # 29 m/km a mais de subida
    long_old = act(50, km=15, elev=10)
    assert analyze([flat_old, hilly_new, long_old], TODAY)["sessoes_equivalentes"] == []


def test_equivalent_session_higher_cost():
    (eq,) = analyze([act(40, pace=330, hr=145), act(2, pace=345, hr=155)], TODAY)["sessoes_equivalentes"]
    assert eq["veredito"] == "custo_maior"


def test_cadence_profile_by_pace_band():
    runs = [act(d, pace=335, cadence=c) for d, c in ((5, 170), (9, 174), (12, 172))] + [act(15, pace=400, cadence=160)]
    profile = analyze(runs, TODAY)["cadencia_habitual"]
    assert profile == [{"faixa_ritmo": "5:30–5:59/km", "cadencia_mediana_ppm": 172, "corridas": 3}]


# ── ACWR ───────────────────────────────────────────────────────────────────


def test_acwr_is_none_when_chronic_load_is_tiny():
    # caso real: 0,7 km depois de 3 semanas parado dava ACWR 4,0
    day = date(2026, 9, 9)
    assert _compute_acwr({day: 3.0}, day) is None


def test_acwr_with_real_base():
    day = date(2026, 6, 1)
    loads = {day - timedelta(days=i): 40.0 for i in range(28)}
    assert _compute_acwr(loads, day) == pytest.approx(1.0)


def _metric(ctl, tsb, acwr):
    return SimpleNamespace(ctl=ctl, tsb=tsb, acwr=acwr)


def test_recommendation_after_a_break_is_gradual_return_not_hard():
    # caso real 2026-09-21: TSB +6,7 so porque o condicionamento caiu (CTL 6,9)
    rec = training_recommendation(_metric(ctl=6.9, tsb=6.7, acwr=None))
    assert rec["type"] == "easy"
    assert rec["label"] == "Retomada gradual"


def test_recommendation_with_base_still_uses_tsb_and_acwr():
    assert training_recommendation(_metric(ctl=40, tsb=8, acwr=1.0))["type"] == "hard"
    assert training_recommendation(_metric(ctl=40, tsb=-5, acwr=1.0))["type"] == "moderate"
    assert training_recommendation(_metric(ctl=40, tsb=0, acwr=1.7))["type"] == "rest"
