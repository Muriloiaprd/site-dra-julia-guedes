"""Servico do treinador de IA: monta contexto real do atleta, chama Claude
(com fallback pro Gemini) e persiste chat/analises/plano de treino."""

from __future__ import annotations

import json
import uuid
from datetime import date, timedelta

import anthropic
from pydantic import BaseModel
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ondilow_api.config import settings
from ondilow_api.metrics.predictions import (
    assess_injury_risk,
    predict_race_times,
    training_recommendation,
)
from ondilow_api.models.activity import Activity
from ondilow_api.models.coach import CoachInteraction, PlannedWorkout
from ondilow_api.models.daily_metric import DailyMetric
from ondilow_api.models.record import PersonalRecord
from ondilow_api.models.user import AthleteProfile

_RUN_RECORD_TYPES = {
    "fastest_1k", "fastest_5k", "fastest_10k", "fastest_21k", "fastest_42k",
}
_MIN_WEEKS_FOR_ANALYSIS = 2
_CHAT_HISTORY_LIMIT = 20

_SPORT_GROUPS = {
    "run": "run", "trail_run": "run", "treadmill": "run",
    "bike": "bike", "mtb": "bike", "gravel": "bike", "indoor_bike": "bike",
    "swim": "swim", "open_water_swim": "swim",
}


def _same_sport_group(a: str, b: str) -> bool:
    return _SPORT_GROUPS.get(a, a) == _SPORT_GROUPS.get(b, b)


class CoachError(Exception):
    pass


class CoachUnavailableError(CoachError):
    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(reason)


class CoachPlanParseError(CoachError):
    pass


class InsufficientDataError(CoachError):
    def __init__(self, weeks_available: float):
        self.weeks_available = weeks_available
        super().__init__("insufficient_data")


SYSTEM_PROMPT = """Voce e o treinador virtual do Ondilow: um especialista em triathlon com
profundo conhecimento de corrida, ciclismo e natacao, alem de fisioterapia e pilates
aplicados a prevencao de lesao do atleta amador serio.

Baseie-se nas metodologias de treinamento estabelecidas — periodizacao classica,
treino polarizado, VDOT/formula de Jack Daniels, e o modelo de carga
CTL/ATL/TSB (Coggan/TrainingPeaks) — e sempre fundamente sua analise nos dados
reais fornecidos no contexto. Nunca invente numeros, recordes ou metricas que
nao estejam no contexto.

Responda sempre em portugues do Brasil, de forma direta e pratica, como um
treinador experiente conversando com o atleta — sem jargao excessivo, mas
citando os conceitos por nome quando forem relevantes para a recomendacao.
Se o risco de lesao ou overtraining (ACWR, TSB) estiver elevado, priorize
seguranca sobre performance e sugira ajustes concretos (volume, intensidade,
mobilidade/fortalecimento) antes de qualquer progressao."""

_PLAN_INSTRUCTION = """Monte um plano de treino real para os proximos {days} dias
corridos, comecando em {start_date}, com base no contexto do atleta (JSON) abaixo.
Um treino por dia. Varie intensidade e modalidade de forma coerente com o TSB/ACWR
atual, o esporte predominante do atleta, e a metodologia de periodizacao. Inclua
pelo menos um dia de recuperacao/descanso na semana. As datas devem ser strings
no formato AAAA-MM-DD, cada uma dentro do intervalo pedido, sem repetir data.

Contexto do atleta (JSON):
{context}"""


class PlannedWorkoutItem(BaseModel):
    date: str
    sport: str
    title: str
    description: str
    target_duration_s: int | None = None
    target_distance_m: float | None = None
    target_tss: float | None = None
    target_intensity: str | None = None


class WorkoutPlanResponse(BaseModel):
    workouts: list[PlannedWorkoutItem]


def _activity_summary(act: Activity) -> dict:
    return {
        "date": act.start_time.date().isoformat(),
        "sport": act.sport,
        "duration_s": act.duration_s,
        "distance_m": float(act.distance_m) if act.distance_m else None,
        "avg_hr": act.avg_hr,
        "avg_pace_s_per_km": float(act.avg_pace_s_per_km) if act.avg_pace_s_per_km else None,
        "avg_speed_kmh": float(act.avg_speed_kmh) if act.avg_speed_kmh else None,
        "elevation_gain_m": float(act.elevation_gain_m) if act.elevation_gain_m else None,
        "tss": float(act.tss) if act.tss else None,
    }


def build_context(db: Session, user_id: uuid.UUID) -> dict:
    profile = db.execute(
        select(AthleteProfile).where(AthleteProfile.user_id == user_id)
    ).scalar_one_or_none()

    earliest_start = db.execute(
        select(func.min(Activity.start_time)).where(
            Activity.user_id == user_id, Activity.deleted_at.is_(None)
        )
    ).scalar_one_or_none()

    weeks_available = 0.0
    if earliest_start:
        weeks_available = (date.today() - earliest_start.date()).days / 7

    since90 = date.today() - timedelta(days=90)
    metrics = db.execute(
        select(DailyMetric)
        .where(
            DailyMetric.user_id == user_id,
            DailyMetric.sport.is_(None),
            DailyMetric.date >= since90,
        )
        .order_by(DailyMetric.date.asc())
    ).scalars().all()

    recent_activities = db.execute(
        select(Activity)
        .where(Activity.user_id == user_id, Activity.deleted_at.is_(None))
        .order_by(Activity.start_time.desc())
        .limit(30)
    ).scalars().all()

    records = db.execute(
        select(PersonalRecord).where(PersonalRecord.user_id == user_id)
    ).scalars().all()
    run_records = [r for r in records if r.record_type in _RUN_RECORD_TYPES]

    latest_metric = metrics[-1] if metrics else None

    return {
        "insufficient_data": weeks_available < _MIN_WEEKS_FOR_ANALYSIS,
        "weeks_available": round(weeks_available, 1),
        "profile": {
            "weight_kg": float(profile.weight_kg) if profile and profile.weight_kg else None,
            "resting_hr": profile.resting_hr if profile else None,
            "max_hr": profile.max_hr if profile else None,
            "ftp_watts": profile.ftp_watts if profile else None,
            "css_pace_s_per_100m": float(profile.css_pace_s_per_100m) if profile and profile.css_pace_s_per_100m else None,
        },
        "recent_activities": [_activity_summary(a) for a in recent_activities],
        "daily_metrics_last_30": [
            {
                "date": m.date.isoformat(),
                "daily_load": float(m.daily_load) if m.daily_load else None,
                "ctl": float(m.ctl) if m.ctl else None,
                "atl": float(m.atl) if m.atl else None,
                "tsb": float(m.tsb) if m.tsb else None,
                "acwr": float(m.acwr) if m.acwr else None,
            }
            for m in metrics[-30:]
        ],
        "personal_records": [
            {"sport": r.sport, "record_type": r.record_type, "value": float(r.value), "unit": r.unit}
            for r in records
        ],
        "race_predictions": predict_race_times(run_records),
        "risk": assess_injury_risk(list(metrics)),
        "recommendation": training_recommendation(latest_metric),
    }


def reconcile_plan(db: Session, user_id: uuid.UUID) -> None:
    """Casa treinos planejados com atividades reais ja importadas (mesma data,
    esporte compativel) para marcar aderencia, e marca como 'skipped' os
    treinos de dias que ja passaram sem nenhuma atividade correspondente."""
    pending = db.execute(
        select(PlannedWorkout).where(
            PlannedWorkout.user_id == user_id,
            PlannedWorkout.status == "planned",
            PlannedWorkout.activity_id.is_(None),
        )
    ).scalars().all()
    if not pending:
        return

    dates = {w.date for w in pending}
    activities = db.execute(
        select(Activity).where(
            Activity.user_id == user_id,
            Activity.deleted_at.is_(None),
            func.date(Activity.start_time).in_(dates),
        )
    ).scalars().all()

    by_date: dict[date, list[Activity]] = {}
    for act in activities:
        by_date.setdefault(act.start_time.date(), []).append(act)

    today = date.today()
    changed = False
    for w in pending:
        match = next((a for a in by_date.get(w.date, []) if _same_sport_group(a.sport, w.sport)), None)
        if match:
            w.activity_id = match.id
            w.status = "done"
            changed = True
        elif w.date < today:
            w.status = "skipped"
            changed = True

    if changed:
        db.commit()


def _call_anthropic(system_prompt: str, user_content: str, response_model: type[BaseModel] | None):
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key) if settings.anthropic_api_key else anthropic.Anthropic()
    system_blocks = [{"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}}]

    if response_model is not None:
        response = client.messages.parse(
            model=settings.anthropic_model,
            max_tokens=4096,
            system=system_blocks,
            messages=[{"role": "user", "content": user_content}],
            output_format=response_model,
        )
        return response.parsed_output, settings.anthropic_model

    response = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=4096,
        system=system_blocks,
        messages=[{"role": "user", "content": user_content}],
    )
    text = next((b.text for b in response.content if b.type == "text"), "")
    return text, settings.anthropic_model


def _call_gemini(system_prompt: str, user_content: str, response_model: type[BaseModel] | None):
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=settings.gemini_api_key)

    if response_model is not None:
        config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            response_schema=response_model,
        )
        resp = client.models.generate_content(model=settings.gemini_model, contents=user_content, config=config)
        try:
            parsed = response_model.model_validate_json(resp.text)
        except Exception as e:
            raise CoachPlanParseError(f"Gemini retornou JSON invalido: {e}") from e
        return parsed, settings.gemini_model

    config = types.GenerateContentConfig(system_instruction=system_prompt)
    resp = client.models.generate_content(model=settings.gemini_model, contents=user_content, config=config)
    return resp.text, settings.gemini_model


def call_llm(
    system_prompt: str,
    user_content: str,
    *,
    response_model: type[BaseModel] | None = None,
):
    if not settings.anthropic_api_key and not settings.gemini_api_key:
        raise CoachUnavailableError("not_configured")

    anthropic_error: Exception | None = None
    if settings.anthropic_api_key:
        try:
            return _call_anthropic(system_prompt, user_content, response_model)
        except (
            anthropic.RateLimitError,
            anthropic.AuthenticationError,
            anthropic.PermissionDeniedError,
            anthropic.APIConnectionError,
        ) as e:
            anthropic_error = e
        except anthropic.APIStatusError as e:
            if e.status_code >= 500:
                anthropic_error = e
            else:
                raise

    if settings.gemini_api_key:
        return _call_gemini(system_prompt, user_content, response_model)

    raise CoachUnavailableError("llm_unavailable") from anthropic_error


def _require_sufficient_data(context: dict) -> None:
    if context["insufficient_data"]:
        raise InsufficientDataError(context["weeks_available"])


def chat(db: Session, user_id: uuid.UUID, message: str) -> tuple[str, str]:
    context = build_context(db, user_id)
    history = db.execute(
        select(CoachInteraction)
        .where(CoachInteraction.user_id == user_id, CoachInteraction.kind == "chat")
        .order_by(CoachInteraction.created_at.desc())
        .limit(_CHAT_HISTORY_LIMIT)
    ).scalars().all()
    history = list(reversed(history))
    convo = "\n".join(f"{h.role}: {h.content}" for h in history)

    user_content = (
        f"Contexto atual do atleta (JSON):\n{json.dumps(context, ensure_ascii=False)}\n\n"
        f"Historico da conversa:\n{convo}\n\n"
        f"Nova mensagem do atleta:\n{message}"
    )
    reply, model_used = call_llm(SYSTEM_PROMPT, user_content)

    db.add(CoachInteraction(user_id=user_id, kind="chat", role="user", content=message))
    db.add(CoachInteraction(user_id=user_id, kind="chat", role="assistant", content=reply, model_used=model_used))
    db.commit()
    return reply, model_used


def generate_analysis(db: Session, user_id: uuid.UUID) -> tuple[str, str]:
    context = build_context(db, user_id)
    _require_sufficient_data(context)

    user_content = (
        "Analise os dados de treino do atleta abaixo (JSON) e escreva um relatorio em "
        "portugues com: pontos fortes, pontos a melhorar, e recomendacoes concretas "
        "para as proximas semanas.\n\n"
        f"Contexto (JSON):\n{json.dumps(context, ensure_ascii=False)}"
    )
    report, model_used = call_llm(SYSTEM_PROMPT, user_content)

    db.add(CoachInteraction(user_id=user_id, kind="analysis", role=None, content=report, model_used=model_used))
    db.commit()
    return report, model_used


def _validate_plan_items(items: list[PlannedWorkoutItem], days: int) -> list[PlannedWorkoutItem]:
    today = date.today()
    horizon_end = today + timedelta(days=days)
    valid = []
    for item in items:
        try:
            item_date = date.fromisoformat(item.date)
        except ValueError:
            continue
        if item_date <= today or item_date > horizon_end:
            continue
        if item.target_tss is not None and item.target_tss < 0:
            continue
        valid.append(item)
    if not valid:
        raise CoachPlanParseError("O treinador nao retornou nenhum treino valido para o periodo pedido.")
    return valid


def generate_plan(db: Session, user_id: uuid.UUID, days: int = 7) -> tuple[list[PlannedWorkout], str]:
    context = build_context(db, user_id)
    _require_sufficient_data(context)

    start_date = date.today() + timedelta(days=1)
    user_content = _PLAN_INSTRUCTION.format(
        days=days,
        start_date=start_date.isoformat(),
        context=json.dumps(context, ensure_ascii=False),
    )
    parsed, model_used = call_llm(SYSTEM_PROMPT, user_content, response_model=WorkoutPlanResponse)
    items = _validate_plan_items(parsed.workouts, days)

    today = date.today()
    horizon_end = today + timedelta(days=days)
    db.execute(
        delete(PlannedWorkout).where(
            PlannedWorkout.user_id == user_id,
            PlannedWorkout.status == "planned",
            PlannedWorkout.date > today,
            PlannedWorkout.date <= horizon_end,
        )
    )

    batch_id = uuid.uuid4()
    rows = []
    for item in items:
        row = PlannedWorkout(
            user_id=user_id,
            date=date.fromisoformat(item.date),
            sport=item.sport,
            title=item.title,
            description=item.description,
            target_duration_s=item.target_duration_s,
            target_distance_m=item.target_distance_m,
            target_tss=item.target_tss,
            target_intensity=item.target_intensity,
            plan_batch_id=batch_id,
        )
        db.add(row)
        rows.append(row)
    db.commit()
    return rows, model_used
