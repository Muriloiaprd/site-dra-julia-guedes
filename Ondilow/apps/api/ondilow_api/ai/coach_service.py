"""Servico da Duni, a treinadora de IA: monta o contexto real do atleta, chama o
modelo (Claude se houver chave, senao Gemini) e persiste chat/analises/plano."""

from __future__ import annotations

import json
import time
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

import anthropic
from pydantic import BaseModel
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ondilow_api.ai.athlete_analysis import build_analysis, effective_kind
from ondilow_api.config import settings
from ondilow_api.metrics.predictions import predict_race_times, training_recommendation
from ondilow_api.models.activity import Activity
from ondilow_api.models.coach import AthleteMemory, CoachInteraction, PlannedWorkout
from ondilow_api.models.daily_metric import DailyMetric
from ondilow_api.models.record import PersonalRecord
from ondilow_api.models.user import AthleteProfile

_RUN_RECORD_ORDER = ("fastest_1k", "fastest_5k", "fastest_10k", "fastest_21k", "fastest_42k")
_RUN_RECORD_TYPES = set(_RUN_RECORD_ORDER)
_MIN_WEEKS_FOR_ANALYSIS = 2
_CHAT_HISTORY_LIMIT = 20
# Detalhe atividade por atividade so do recente; o resto vem agregado na analise.
_RECENT_DETAIL_DAYS = 14
_RECENT_DETAIL_LIMIT = 15

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


# Versao do prompt: settings.coach_prompt_version. v2 = Duni (Anexo A do
# PLANEJAMENTO_2026-09-21, com os ajustes da secao "Onde eu discordo do prompt").
SYSTEM_PROMPT = """Você é a Duni, treinadora de corrida de rua do Ondilow. Domina
fisiologia do exercício, biomecânica da corrida e periodização, e treina um atleta
amador sério. Fale sempre em português do Brasil, no feminino ("sou sua treinadora").

TOM
- Direta e exigente: cobra consistência e diz com clareza quando o atleta errou a mão
  (pulou treino, correu forte no dia fácil, aumentou demais). Segurança vem antes da
  cobrança: diante de dor, fadiga acumulada ou risco, a prioridade é proteger o atleta.
- Linguagem simples, sem jargão. Quando usar um termo técnico, explique na prática na
  primeira vez: "PSE 3/10 = leve, dá para conversar sem perder o fôlego"; "GAP = o
  ritmo equivalente no plano, descontando subidas e descidas".

DADOS (o campo "analise" do contexto já traz os cálculos feitos pelo código)
- Quem calcula é o código; você interpreta. Use os números de "analise" (janelas de
  7/14/28 dias, tendência semanal, carga, sinais de fadiga, sessões equivalentes,
  cadência habitual, check-ins) em vez de refazer contas. Nunca invente número,
  treino, recorde ou métrica que não esteja no contexto.
- Olhe o histórico, não só a última semana: compare 7, 14 e 28 dias com a tendência
  de 8 semanas para ver como o atleta RESPONDE ao treino.
- Leia "cobertura_de_dados" antes de concluir. Se houver aviso de dias sem
  atividade, pergunte se foi pausa ou atividade não importada antes de dizer que ele
  destreinou. Sono, HRV, Training Readiness, tempo de recuperação e tipo de terreno
  não existem no Ondilow: diga que não tem esses dados quando fariam diferença, e
  nunca suponha valores.
- Combine carga externa (km, tempo, ritmo, GAP, subida, sessões) e interna (FC, PSE,
  carga sRPE, sensação, dor). Nunca decida por uma métrica isolada, e não use regra
  fixa de % de aumento semanal.
- Diferencie sinal isolado de tendência (o campo "sinais_de_fadiga" já marca qual é).
  Um treino ruim isolado não muda o plano; vários sinais na mesma direção, sim.
- Desempenho: compare sessões equivalentes ("antes 10 km a 5:30 com FC 150, agora
  5:25 com FC 146") e diga se houve melhora, estabilidade, regressão ou custo maior.
- Aderência ("aderencia_4_semanas"): cobre com o dado real. Treinos pulados ou
  trocados entram na conversa, sem sermão, com a consequência prática.

REGRAS DE TREINO
- Foco em corrida. Bicicleta, academia, Pilates e caminhada são carga complementar:
  contam no cansaço, mas você não prescreve esses treinos.
- Ritmo, FC e PSE juntos. Treino fácil é guiado por percepção e FC baixa, não pelo
  pace. Treino de qualidade: ritmo/GAP + FC + PSE. Na subida, não cobre o pace
  absoluto: mantenha o esforço e deixe o ritmo cair; na descida, não acelere para
  compensar.
- Cadência: não existe regra de 180 passos por minuto. Parta da cadência habitual do
  atleta em cada faixa de ritmo e só sugira mudanças pequenas e justificadas.
- A maior parte do volume em intensidade leve; evite a semana cheia de treinos
  moderados. Não suba volume, intensidade e frequência ao mesmo tempo.
- 1 a 2 dias de descanso por semana (total ou atividade muito leve). Treino com carga
  relevante não conta como descanso.
- Autorregulação: FC alta + PSE alta + ritmo baixo → aliviar. Dor aumentando →
  parar ou modificar o treino.
- Cada treino tem uma finalidade fisiológica clara. Não coloque intensidade só porque
  há uma prova marcada.

SEGURANÇA
- Não diagnostique lesão nem doença. Dor que persiste ou piora → recomende avaliação
  com fisioterapeuta ou médico do esporte.
- O status é 🟢 recuperado, 🟡 atenção, 🟠 fadiga acumulada ou 🔴 recuperação
  prioritária. Sempre diga quais dados levaram ao status; ele não é diagnóstico.

MEMÓRIAS E OBJETIVO
- "memorias" é o que o atleta confirmou sobre si: objetivo, provas com data, lesões,
  dias disponíveis e preferências. Respeite tudo isso. Se "objetivo_cadastrado" for
  falso, pergunte o objetivo antes de montar a próxima semana.
- Zonas de FC são estimadas pela FC máxima do perfil. Se a análise de intensidade
  pesar numa decisão, vale confirmar se essa FC máxima foi medida de verdade."""

_PLAN_INSTRUCTION = """Monte um plano de treino para os proximos {days} dias
corridos, comecando em {start_date}, com base no contexto do atleta (JSON) abaixo.
No maximo um treino por dia; dia de descanso fica SEM item (senao conta como treino
pulado na aderencia). Siga as regras de treino do seu papel: foco em corrida (use
"run" ou "trail_run"), 1 a 2 dias de descanso, a maior parte leve, e cada treino
com um objetivo claro na descricao.
Ajuste a carga pelo que "analise" mostra (janelas, tendencia, sinais de fadiga,
cobertura de dados) e pela aderencia recente. As datas devem ser strings no formato
AAAA-MM-DD, cada uma dentro do intervalo pedido, sem repetir data.
Respeite as memorias do atleta (campo "memorias"): so marque treino nos dias
disponiveis, evite o que agrava uma lesao ativa e oriente a semana pelo objetivo
e pelas provas com data. Sem objetivo cadastrado, monte uma semana de base
aerobica e diga isso na descricao do primeiro treino.

Contexto do atleta (JSON):
{context}"""

_ANALYSIS_INSTRUCTION = """Escreva o resumo da semana do atleta em markdown, curto e
direto, nesta ordem:
1. **Status** (🟢/🟡/🟠/🔴) com os dados que levaram a ele.
2. **Semana anterior**: km, tempo, treinos, longao, intensidade e complementares
   (use a janela de 7 dias e compare com 28 dias e a tendencia).
3. **Avaliacao**: pontos positivos, sinais de fadiga (isolado ou tendencia), riscos
   e evolucao (sessoes equivalentes, se houver).
4. **Aderencia** ao plano nas ultimas 4 semanas, se houver plano.
5. **Proxima semana**: volume aproximado, numero de sessoes, estimulo principal e
   objetivo. Sem objetivo cadastrado, diga isso e pergunte.
6. **O que falta de dado** para uma analise melhor (so o que faria diferenca).

Contexto (JSON):
{context}"""

_CHAT_MEMORY_INSTRUCTION = """Alem da resposta, avalie se a mensagem do atleta
trouxe algo NOVO que vale lembrar nas proximas conversas e planos: objetivo,
prova (com data), lesao ou dor recorrente, dias/horarios disponiveis, preferencia
de treino. Coloque em memory_suggestions (no maximo 3), cada uma curta e na
terceira pessoa (ex.: "Meia maratona em 30/11"). Use event_date (AAAA-MM-DD) so
quando o atleta disser a data. Nao sugira o que ja esta em "memorias" no contexto,
nem suposicoes suas. Se nada novo apareceu, devolva a lista vazia."""


class ChatMemorySuggestion(BaseModel):
    kind: Literal["objetivo", "prova", "lesao", "disponibilidade", "preferencia", "outro"]
    content: str
    event_date: str | None = None


class ChatReply(BaseModel):
    reply: str
    memory_suggestions: list[ChatMemorySuggestion] = []


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


def _fmt_pace(s_per_km) -> str | None:
    if not s_per_km:
        return None
    s = round(float(s_per_km))
    return f"{s // 60}:{s % 60:02d}/km"


def _fmt_duration(seconds: float) -> str:
    s = round(seconds)
    h, rem = divmod(s, 3600)
    return f"{h}:{rem // 60:02d}:{rem % 60:02d}" if h else f"{rem // 60}:{rem % 60:02d}"


def _activity_detail(act: Activity) -> dict:
    """Uma atividade recente como a Duni le: data local, numeros ja formatados e
    o check-in. Campos vazios saem do dict para nao gastar contexto."""
    kind = effective_kind(act.sport, float(act.avg_pace_s_per_km) if act.avg_pace_s_per_km else None)
    item = {
        "data": act.start_time.astimezone(ZoneInfo(act.timezone or "America/Sao_Paulo")).date().isoformat(),
        "tipo": kind,
        "titulo": act.title,
        "km": round(float(act.distance_m) / 1000, 2) if act.distance_m else None,
        "minutos": round((act.moving_time_s or act.duration_s) / 60),
        "ritmo": _fmt_pace(act.avg_pace_s_per_km) if kind in ("run", "walk") else None,
        "gap": _fmt_pace(act.gap_pace_s_per_km) if kind == "run" else None,
        "fc_media": act.avg_hr,
        "fc_max": act.max_hr,
        "cadencia_ppm": round(float(act.avg_cadence)) if act.avg_cadence and kind == "run" else None,
        "deriva_cardiaca_pct": float(act.hr_decoupling_pct) if act.hr_decoupling_pct is not None else None,
        "subida_m": round(float(act.elevation_gain_m)) if act.elevation_gain_m else None,
        "pse": act.rpe,
        "sensacao": act.feeling,
        "dor": act.pain_level,
        "local_dor": act.pain_location,
        "observacoes": act.checkin_notes,
    }
    return {k: v for k, v in item.items() if v is not None}


def adherence_context(db: Session, user_id: uuid.UUID, today: date | None = None) -> dict:
    """Planejado x feito nas ultimas 4 semanas (dias ja passados), para a Duni
    cobrar com dado real. Chame depois de reconcile_plan."""
    today = today or date.today()
    rows = db.execute(
        select(PlannedWorkout)
        .where(
            PlannedWorkout.user_id == user_id,
            PlannedWorkout.date >= today - timedelta(days=28),
            PlannedWorkout.date < today,
        )
        .order_by(PlannedWorkout.date.asc())
    ).scalars().all()
    if not rows:
        return {"planejados": 0, "nota": "Nenhum treino planejado nas últimas 4 semanas."}
    done = [w for w in rows if w.status == "done"]
    skipped = [w for w in rows if w.status == "skipped"]
    return {
        "planejados": len(rows),
        "feitos": len(done),
        "pulados": len(skipped),
        "percentual_feito": round(100 * len(done) / len(rows)),
        "pulados_detalhe": [{"data": w.date.isoformat(), "treino": w.title} for w in skipped[-10:]],
    }


def build_context(db: Session, user_id: uuid.UUID) -> dict:
    """Tudo o que a Duni recebe: a analise da Fase 4 (calculada pelo codigo), as
    memorias, a aderencia ao plano e o detalhe das atividades recentes."""
    today = date.today()
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
        weeks_available = (today - earliest_start.date()).days / 7

    # build_analysis completa daily_metrics ate hoje; so depois dele a ultima
    # metrica (usada na recomendacao do app) esta atualizada.
    analysis = build_analysis(db, user_id, today)
    latest_metric = db.execute(
        select(DailyMetric)
        .where(DailyMetric.user_id == user_id, DailyMetric.sport.is_(None), DailyMetric.date <= today)
        .order_by(DailyMetric.date.desc())
        .limit(1)
    ).scalar_one_or_none()

    recent = db.execute(
        select(Activity)
        .where(
            Activity.user_id == user_id,
            Activity.deleted_at.is_(None),
            Activity.start_time >= datetime.combine(today - timedelta(days=_RECENT_DETAIL_DAYS + 1), datetime.min.time(), tzinfo=UTC),
        )
        .order_by(Activity.start_time.desc())
        .limit(_RECENT_DETAIL_LIMIT)
    ).scalars().all()

    # A tabela guarda cada recorde batido; o atual e o mais recente de cada tipo
    # (mesma regra de routers/predictions.py).
    run_records: dict[str, PersonalRecord] = {}
    for r in db.execute(
        select(PersonalRecord)
        .where(PersonalRecord.user_id == user_id, PersonalRecord.record_type.in_(_RUN_RECORD_TYPES))
        .order_by(PersonalRecord.achieved_at.desc())
    ).scalars():
        run_records.setdefault(r.record_type, r)

    reconcile_plan(db, user_id)
    memories = memories_context(db, user_id)

    return {
        "insufficient_data": weeks_available < _MIN_WEEKS_FOR_ANALYSIS,
        "weeks_available": round(weeks_available, 1),
        "memorias": memories,
        "objetivo_cadastrado": any(m["tipo"] == "objetivo" for m in memories),
        "perfil": {
            "peso_kg": float(profile.weight_kg) if profile and profile.weight_kg else None,
            "fc_repouso": profile.resting_hr if profile else None,
            "fc_max": profile.max_hr if profile else None,
        },
        "analise": analysis,
        "aderencia_4_semanas": adherence_context(db, user_id, today),
        f"atividades_ultimos_{_RECENT_DETAIL_DAYS}_dias": [_activity_detail(a) for a in recent],
        "recordes_corrida": [
            {
                "distancia": t.removeprefix("fastest_"),
                "tempo": _fmt_duration(float(r.value)),
                "data": r.achieved_at.date().isoformat(),
            }
            for t, r in sorted(run_records.items(), key=lambda kv: _RUN_RECORD_ORDER.index(kv[0]))
        ],
        "previsoes_de_prova": [
            {"distancia": p["distance"], "tempo_previsto": _fmt_duration(p["predicted_s"]), "base": p["source"], "vdot": p["vdot"]}
            for p in predict_race_times(list(run_records.values()))
        ],
        # O que o dashboard mostra hoje (so TSB/ACWR). Se a Duni discordar, que
        # diga por que, em vez de o app se contradizer calado.
        "recomendacao_do_app": training_recommendation(latest_metric),
    }


def memories_context(db: Session, user_id: uuid.UUID, today: date | None = None) -> list[dict]:
    """Memorias ativas no formato que a Duni le. Datas futuras vem com quantos
    dias faltam (a IA erra conta de calendario)."""
    today = today or date.today()
    rows = db.execute(
        select(AthleteMemory)
        .where(AthleteMemory.user_id == user_id, AthleteMemory.active.is_(True))
        .order_by(AthleteMemory.event_date.asc().nulls_last(), AthleteMemory.created_at.asc())
    ).scalars().all()
    out = []
    for m in rows:
        item: dict = {"tipo": m.kind, "conteudo": m.content}
        if m.event_date:
            item["data"] = m.event_date.isoformat()
            delta = (m.event_date - today).days
            item["quando"] = (
                "hoje" if delta == 0
                else f"faltam {delta} dias" if delta > 0
                else f"foi há {-delta} dias"
            )
        out.append(item)
    return out


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


# Orcamento TOTAL de uma chamada, somando todos os modelos da lista. Tem que
# ficar abaixo do proxyTimeout do Next (240s em apps/web/next.config.mjs): em
# 2026-09-21 o free tier levou minutos so para devolver 503, e um timeout por
# modelo deixava a soma estourar o proxy.
_GEMINI_BUDGET_S = 200.0
# Abaixo disso nao vale comecar outro modelo: nao da tempo de responder.
_GEMINI_MIN_ATTEMPT_S = 20.0
# Sobrecarga momentanea do modelo (nao e cota): vale tentar o proximo da lista.
_GEMINI_OVERLOAD_CODES = {500, 503, 504}


def _gemini_models() -> list[str]:
    """GEMINI_MODEL aceita uma lista separada por virgula, em ordem de preferencia."""
    return [m.strip() for m in settings.gemini_model.split(",") if m.strip()]


def _gemini_error_reason(e: Exception) -> str:
    """Traduz o erro do SDK do Gemini num motivo que o front sabe explicar.

    429 e cota do free tier: nao ha retry (nem aqui nem no SDK), porque tentar
    de novo so queima mais cota."""
    code = getattr(e, "code", None)
    status_ = getattr(e, "status", None) or ""
    message = getattr(e, "message", None) or ""
    if code == 429 or status_ == "RESOURCE_EXHAUSTED":
        return "quota_exceeded"
    if code in (401, 403) or "API_KEY_INVALID" in str(e) or "API key not valid" in message:
        return "invalid_key"
    if code == 404:
        return "model_not_found"
    return "llm_unavailable"


def _call_gemini(system_prompt: str, user_content: str, response_model: type[BaseModel] | None):
    import httpx
    from google import genai
    from google.genai import errors, types

    if response_model is not None:
        config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            response_schema=response_model,
        )
    else:
        config = types.GenerateContentConfig(system_instruction=system_prompt)

    # Cada modelo e tentado uma vez so, com o que sobrou do orcamento. Passa pro
    # proximo apenas em sobrecarga (500/503/504) ou timeout; cota esgotada, chave
    # invalida etc. param na hora.
    deadline = time.monotonic() + _GEMINI_BUDGET_S
    resp = None
    last_error: Exception | None = None
    reason = "llm_unavailable"
    for model in _gemini_models():
        remaining = deadline - time.monotonic()
        if remaining < _GEMINI_MIN_ATTEMPT_S:
            break
        client = genai.Client(
            api_key=settings.gemini_api_key,
            http_options=types.HttpOptions(
                timeout=int(remaining * 1000),
                retry_options=types.HttpRetryOptions(attempts=1),
            ),
        )
        try:
            resp = client.models.generate_content(model=model, contents=user_content, config=config)
            break
        except errors.APIError as e:
            last_error = e
            if e.code not in _GEMINI_OVERLOAD_CODES:
                raise CoachUnavailableError(_gemini_error_reason(e)) from e
        except httpx.TimeoutException as e:
            last_error = e
            reason = "llm_timeout"
    if resp is None:
        raise CoachUnavailableError(reason) from last_error

    if response_model is None:
        return resp.text, model
    try:
        parsed = response_model.model_validate_json(resp.text)
    except Exception as e:
        raise CoachPlanParseError(f"Gemini retornou JSON invalido: {e}") from e
    return parsed, model


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


def chat(db: Session, user_id: uuid.UUID, message: str) -> tuple[str, str, list[dict]]:
    """Resposta da Duni, modelo usado e sugestoes de memoria (ainda nao salvas)."""
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
        f"Nova mensagem do atleta:\n{message}\n\n"
        f"{_CHAT_MEMORY_INSTRUCTION}"
    )
    parsed, model_used = call_llm(SYSTEM_PROMPT, user_content, response_model=ChatReply)
    reply = parsed.reply

    db.add(CoachInteraction(user_id=user_id, kind="chat", role="user", content=message))
    db.add(CoachInteraction(user_id=user_id, kind="chat", role="assistant", content=reply, model_used=model_used))
    db.commit()
    return reply, model_used, clean_memory_suggestions(parsed.memory_suggestions, context["memorias"])


def clean_memory_suggestions(suggestions: list[ChatMemorySuggestion], existing: list[dict]) -> list[dict]:
    """Descarta vazias, repetidas (entre si ou com o que ja esta salvo) e datas
    invalidas; no maximo 3."""
    seen = {m["conteudo"].strip().lower() for m in existing}
    out = []
    for s in suggestions:
        content = s.content.strip()
        key = content.lower()
        if not content or key in seen or len(content) > 500:
            continue
        seen.add(key)
        event_date = None
        if s.event_date:
            try:
                event_date = date.fromisoformat(s.event_date).isoformat()
            except ValueError:
                event_date = None
        out.append({"kind": s.kind, "content": content, "event_date": event_date})
        if len(out) == 3:
            break
    return out


def generate_analysis(db: Session, user_id: uuid.UUID) -> tuple[str, str]:
    context = build_context(db, user_id)
    _require_sufficient_data(context)

    user_content = _ANALYSIS_INSTRUCTION.format(context=json.dumps(context, ensure_ascii=False))
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
