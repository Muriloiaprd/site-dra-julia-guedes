"""Servico da Duni, a treinadora de IA: monta o contexto real do atleta, chama o
modelo (Claude se houver chave, senao Gemini) e persiste chat/analises/plano."""

from __future__ import annotations

import json
import time
import uuid
from dataclasses import dataclass
from dataclasses import field as dc_field
from datetime import UTC, date, datetime, timedelta
from typing import ClassVar, Literal
from zoneinfo import ZoneInfo

import anthropic
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from kactus_api.ai import goal_plan, training_history
from kactus_api.ai.athlete_analysis import build_analysis, effective_kind
from kactus_api.checkin_tags import tag_labels
from kactus_api.config import settings
from kactus_api.metrics.basic import PointLike, hr_zone_distribution, resolve_hr_zones
from kactus_api.metrics.garmin import benefit_label
from kactus_api.metrics.predictions import (
    predict_race_times,
    training_recommendation,
)
from kactus_api.models.activity import Activity, ActivityLap, ActivityPoint
from kactus_api.models.coach import (
    AthleteMemory,
    CoachInteraction,
    GoalPlan,
    PlannedWorkout,
    WeeklyPlan,
)
from kactus_api.models.daily_metric import DailyMetric
from kactus_api.models.record import PersonalRecord
from kactus_api.models.user import AthleteProfile

_RUN_RECORD_ORDER = ("fastest_1k", "fastest_5k", "fastest_10k", "fastest_21k", "fastest_42k")
_RUN_RECORD_TYPES = set(_RUN_RECORD_ORDER)
_MIN_WEEKS_FOR_ANALYSIS = 2
_CHAT_HISTORY_LIMIT = 20

# Mais recente primeiro (o chamador inverte). No empate de created_at, que as
# mensagens antigas tem, "assistant" < "user" deixa a pergunta antes da resposta.
CHAT_ORDER_DESC = (CoachInteraction.created_at.desc(), CoachInteraction.role.asc())
# Detalhe atividade por atividade so do recente; o resto vem agregado na analise.
# O ultimo mes inteiro em detalhe (o plano olha o que o atleta fez, nao so 2 semanas).
_RECENT_DETAIL_DAYS = 28
_RECENT_DETAIL_LIMIT = 30

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
# v3 (2026-09-23) = sem se apresentar, tratamento pelo perfil, status mede cansaco.
# v4 (2026-09-27) = secao ESCRITA (curto, sem siglas), resumo estruturado, limites no plano.
SYSTEM_PROMPT = """Você é a Duni, treinadora de corrida de rua do Kactus. Domina
fisiologia do exercício, biomecânica da corrida e periodização, e treina um atleta
amador sério. Fale sempre em português do Brasil, referindo-se a si mesma no feminino.
Não se apresente nem abra o texto dizendo quem você é: o atleta já sabe. Comece direto
pelo assunto. Ao falar do atleta, siga "perfil.tratamento": "feminino" ou "masculino"
para concordar as palavras (cansada/cansado); "neutro" quando não se sabe, e então
evite adjetivos com gênero sobre ele ("você ficou sem treinar", não "você ficou
parado"), a não ser que o próprio atleta use um gênero ao falar de si na conversa.

TOM
- Direta e exigente: cobra consistência e diz com clareza quando o atleta errou a mão
  (pulou treino, correu forte no dia fácil, aumentou demais). Segurança vem antes da
  cobrança: diante de dor, fadiga acumulada ou risco, a prioridade é proteger o atleta.
- Linguagem simples, sem jargão. Quando usar um termo técnico, explique na prática na
  primeira vez: "zona 2 = leve, dá para conversar sem perder o fôlego"; "GAP = o
  ritmo equivalente no plano, descontando subidas e descidas".

ESCRITA (o atleta lê rápido, muitas vezes no celular)
- Curto e claro: frases de até ~15 palavras, uma ideia por frase, listas de no
  máximo 3 itens. Diga só o que muda o que ele vai fazer.
- Só os números que pesam na decisão (km da semana, FC de um treino, dor). Não
  despeje métricas.
- Sem siglas soltas: "disposição" (não TSB), "salto de carga" (não ACWR),
  "condicionamento" (não CTL), "cansaço recente" (não ATL), "carga do treino" (não
  TSS nem sRPE). VDOT e GAP só com a explicação curta na primeira vez.
- NUNCA escreva "PSE" nem notas de esforço como "3/10": o atleta não entende. Guie
  o treino por frequência cardíaca (zona e faixa em bpm de "perfil.zonas_fc_bpm"),
  distância, ritmo e tempo. O campo "pse" do contexto é o esforço que o atleta
  marcou no check-in: fale "o esforço que você marcou", sem número de escala.
- Na conversa, responda em até ~100 palavras, a não ser que o atleta peça detalhes.

DADOS (o campo "analise" do contexto já traz os cálculos feitos pelo código)
- Quem calcula é o código; você interpreta. Use os números de "analise" (janelas de
  7/14/28 dias, tendência semanal, carga, sinais de fadiga, sessões equivalentes,
  cadência habitual, check-ins) em vez de refazer contas. Nunca invente número,
  treino, recorde ou métrica que não esteja no contexto.
- "contexto" no check-in são marcações rápidas do próprio atleta (calor, dormi mal,
  ritmo travou, esteira...): use para explicar o desempenho daquele treino.
- Dados do relógio, quando houver: "efeito_treino" (aeróbico e anaeróbico de 0 a 5 e
  o benefício principal) mostra se um treino fácil foi mesmo fácil; calor
  ("temperatura_c" alta) sobe a FC, então considere antes de falar em queda de forma.
- Olhe o histórico, não só a última semana: compare 7, 14 e 28 dias com a tendência
  de 8 semanas para ver como o atleta RESPONDE ao treino.
- Leia "cobertura_de_dados" antes de concluir. Se houver aviso de dias sem
  atividade, pergunte se foi pausa ou atividade não importada antes de dizer que ele
  destreinou. Sono, HRV, Training Readiness, tempo de recuperação e tipo de terreno
  não existem no Kactus: diga que não tem esses dados quando fariam diferença, e
  nunca suponha valores.
- Combine carga externa (km, tempo, ritmo, GAP, subida, sessões) e interna (FC,
  esforço marcado no check-in, sensação, dor). Nunca decida por uma métrica isolada, e não use regra
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
- Ritmo e FC juntos. Treino fácil é guiado pela FC baixa (dá para conversar), não
  pelo pace. Treino de qualidade: ritmo/GAP + FC. Na subida, não cobre o pace
  absoluto: mantenha o esforço e deixe o ritmo cair; na descida, não acelere para
  compensar.
- Cadência: não existe regra de 180 passos por minuto. Parta da cadência habitual do
  atleta em cada faixa de ritmo e só sugira mudanças pequenas e justificadas.
- A maior parte do volume em intensidade leve; evite a semana cheia de treinos
  moderados. Não suba volume, intensidade e frequência ao mesmo tempo.
- 1 a 2 dias de descanso por semana (total ou atividade muito leve). Treino com carga
  relevante não conta como descanso.
- Autorregulação: FC alta para o ritmo + esforço marcado alto → aliviar. Dor aumentando →
  parar ou modificar o treino.
- Cada treino tem uma finalidade fisiológica clara. Não coloque intensidade só porque
  há uma prova marcada.

SEGURANÇA
- Não diagnostique lesão nem doença. Dor que persiste ou piora → recomende avaliação
  com fisioterapeuta ou médico do esporte.
- O status é 🟢 recuperado, 🟡 atenção, 🟠 fadiga acumulada ou 🔴 recuperação
  prioritária. Sempre diga quais dados levaram ao status; ele não é diagnóstico.
  O status mede o CANSAÇO, não a forma. 🟠 e 🔴 exigem sinais de fadiga, dor ou
  doença (FC alta para o ritmo, esforço marcado alto, dor que piora, carga aguda muito acima da
  crônica). Pouco treino ou uma pausa não é 🔴: o corpo está descansado, então é 🟢,
  ou 🟡 quando a volta precisa de cuidado (lesão anterior, pausa longa).

MEMÓRIAS E OBJETIVO
- "memorias" é o que o atleta confirmou sobre si: objetivo, provas com data, lesões,
  dias disponíveis e preferências. Respeite tudo isso. Se "objetivo_cadastrado" for
  falso, pergunte o objetivo antes de montar a próxima semana.
- Você não guarda memórias: só sugere, e o atleta confirma com um clique. Nunca diga
  "anotei", "guardei", "registrei" ou "salvei".
- Zonas de FC são estimadas pela FC máxima do perfil. Se a análise de intensidade
  pesar numa decisão, vale confirmar se essa FC máxima foi medida de verdade."""

_WEEK_PLAN_INSTRUCTION = """Analise o atleta e monte o plano da proxima semana.
Os 7 dias da semana sao: {days}. O primeiro e HOJE: se o atleta ja treinou
hoje (veja as atividades recentes), deixe hoje sem treino.

Preencha o JSON pedido:
- status (verde = recuperado, amarelo = atencao, laranja = fadiga acumulada,
  vermelho = recuperacao prioritaria) e status_justificativa citando os dados.
- resumo: 1 a 2 frases curtas com a leitura da semana que passou e o plano.
- avaliacao: pontos positivos, sinais de fadiga (diga se isolado ou tendencia),
  riscos e evolucao (use as sessoes equivalentes, se houver). No maximo 2 itens
  curtos por lista; lista vazia quando nao houver nada.
- proxima_semana: km previsto, numero de sessoes, estimulo principal e objetivo.
- treinos: SO os dias com treino. Dia de descanso fica SEM item (1 a 2 por semana,
  no minimo 1). Um treino por dia, no maximo. Datas AAAA-MM-DD dentro da semana.
  Para cada treino: esporte (run, trail_run ou treadmill), tipo (ex.: rodagem leve,
  longao, intervalado, limiar, progressivo, regenerativo), titulo curto, objetivo
  (a finalidade, em 1 frase curta), motivo (por que ESTE treino NESTA semana, ligado
  aos dados, em 1 frase curta), intensidade (leve, moderado ou forte), distancia e duracao, ritmo, GAP,
  zona de FC com a faixa em bpm (perfil.zonas_fc_bpm), cadencia (a partir da
  habitual do atleta, nunca 180 como regra), terreno, qual priorizar se ritmo e FC
  discordarem (ritmo, FC ou tempo), observacoes e os passos (aquecimento, principal, desaquecimento;
  no principal, repeticoes e recuperacao quando for intervalado). TODO passo,
  inclusive aquecimento e desaquecimento, tem distancia, duracao e pace (m:ss/km);
  a soma das distancias dos passos e a distancia do treino. Use null no que
  nao se aplica.
- criterios_ajuste: quando manter, reduzir, acelerar e interromper, com sinais
  concretos (FC, ritmo, dor). No maximo 2 itens curtos por lista.
- proximas_4_semanas: 4 itens so com km aproximado e foco de cada semana, sem
  treinos diarios. E uma direcao, nao um compromisso.

Regras que o sistema confere (plano fora delas e recusado): datas dentro da semana,
pelo menos 1 dia sem treino, nenhum treino forte com status vermelho, objetivo e
motivo em todo treino.
Respeite as memorias (dias disponiveis, lesoes, objetivo, provas com data). Sem
objetivo cadastrado, monte uma semana de base aerobica e diga isso no resumo.
A carga da semana anterior ja e calculada pelo sistema; nao repita os numeros,
interprete.

Contexto do atleta (JSON):
{context}"""

_REGENERATE_INSTRUCTION = """O atleta pediu para trocar o treino de {day}.
Motivo dele: "{reason}"

Treino atual desse dia (JSON): {current}
Resto da semana (JSON): {week}
Status da semana: {status}

Decida: um treino novo para o mesmo dia, adaptado ao motivo, ou descanso (se o
motivo for dor, cansaco forte ou falta de tempo, descanso pode ser o certo).
Explique a decisao em 1 ou 2 frases em explicacao. Se for treino, preencha treino
com todos os campos (mesma data, objetivo e motivo obrigatorios; sem treino forte
se o status for vermelho) e descanso=false. Se for descanso, treino=null e
descanso=true.

Contexto do atleta (JSON):
{context}"""

_REVIEW_INSTRUCTION = """O atleta quer uma analise do treino de {day} antes de fazer.
{question}
Treino planejado desse dia (JSON): {current}
Resto da semana (JSON): {week}
Status da semana: {status}
{goal}

Analise se ESTE treino faz sentido para o atleta AGORA: carga recente (7 x 28 dias),
dor e check-ins recentes, o que ele fez nos ultimos dias, a fase do plano do objetivo
e o que vem no resto da semana. Seja honesta e direta:
- adequado: veredito "manter" e sugestao null;
- precisa mudar volume, intensidade ou tipo: veredito "ajustar" e a sugestao
  completa para o MESMO dia, mantendo a finalidade da fase quando der;
- o certo e nao treinar (dor forte, cansaco acumulado): veredito "descanso" e
  sugestao null.
Se o atleta discordou de algo, responda a duvida dele na explicacao.

Contexto do atleta (JSON):
{context}"""

_WEEKDAYS_PT = ("segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo")
WEEKLY_STATUS_EMOJI = {"verde": "🟢", "amarelo": "🟡", "laranja": "🟠", "vermelho": "🔴"}

_ANALYSIS_INSTRUCTION = """Faca o resumo da semana do atleta para ele ler em 20
segundos. Preencha o JSON pedido.
Olhe a janela de 7 dias contra a de 28 dias e a tendencia, os sinais de fadiga, a
aderencia ao plano (se houver) e as memorias. Escolha so o que mais importa agora:
os pontos e as acoes sao os 3 mais relevantes, nao uma lista de tudo.
Sem objetivo cadastrado, a pergunta e qual e o objetivo dele.

Contexto (JSON):
{context}"""

_CHAT_MEMORY_INSTRUCTION = """Alem da resposta, avalie se a mensagem do atleta
trouxe algo NOVO que vale lembrar nas proximas conversas e planos: objetivo,
prova (com data), lesao ou dor recorrente, dias/horarios disponiveis, preferencia
de treino. Coloque em memory_suggestions (no maximo 3), cada uma curta e na
terceira pessoa (ex.: "Meia maratona em 30/11"). Use event_date (AAAA-MM-DD) so
quando o atleta disser a data. Nao sugira o que ja esta em "memorias" no contexto,
nem suposicoes suas. Se nada novo apareceu, devolva a lista vazia.
As sugestoes so viram memoria se o atleta clicar em "Guardar" embaixo da resposta.
Por isso, em reply, nunca diga que anotou, guardou ou registrou algo. Se sugerir,
diga no maximo que ele pode guardar abaixo."""


class AnalysisPoint(BaseModel):
    tipo: Literal["bom", "atencao", "risco"]
    texto: str = Field(description="1 frase curta (ate ~15 palavras), sem siglas.")


class AnalysisLLM(BaseModel):
    """Resumo da semana em pedacos pequenos: a tela monta um cartao com eles."""

    status: Literal["verde", "amarelo", "laranja", "vermelho"]
    status_frase: str = Field(
        description="1 frase (ate ~20 palavras): o status e o dado principal que levou a ele."
    )
    semana: str = Field(
        description="1 frase (ate ~25 palavras) com o que ele fez nos ultimos 7 dias "
        "(km, tempo, treinos) comparado com o normal dele."
    )
    pontos: list[AnalysisPoint] = Field(
        description="Os ate 3 pontos que mais importam agora: bom, atencao ou risco."
    )
    acoes: list[str] = Field(
        description="Ate 3 acoes praticas para os proximos dias, cada uma com ate ~15 "
        "palavras, comecando por verbo."
    )
    pergunta: str | None = Field(
        description="Uma pergunta curta ao atleta so se faltar algo importante (objetivo, "
        "atividade que parece nao importada). Senao, null."
    )


class ChatMemorySuggestion(BaseModel):
    kind: Literal["objetivo", "prova", "lesao", "disponibilidade", "preferencia", "outro"]
    content: str
    event_date: str | None = None


class ChatReply(BaseModel):
    # A descricao vai no schema para o Gemini; o flash-lite ignorava a regra so no texto.
    reply: str = Field(
        description="Resposta ao atleta, curta (ate ~100 palavras, salvo se ele pedir detalhes). "
        "Nunca diga que anotou, guardou, registrou ou salvou algo: quem guarda e o atleta, "
        "clicando nas sugestoes."
    )
    memory_suggestions: list[ChatMemorySuggestion] = []


# ── saida estruturada do plano da semana ────────────────────────────────────
# Sem valores padrao nos campos: o schema vai para o Gemini, e campo opcional e
# "X | None" obrigatorio (o modelo manda null).


class PlanStep(BaseModel):
    fase: Literal["aquecimento", "principal", "desaquecimento"]
    descricao: str
    duracao_min: float | None = Field(description="Minutos deste passo. Preencha em TODOS os passos, inclusive aquecimento e desaquecimento.")
    distancia_km: float | None = Field(
        description="Km deste passo. Preencha em TODOS os passos, inclusive aquecimento e desaquecimento; "
        "a soma dos passos e a distancia total do treino."
    )
    repeticoes: int | None
    ritmo: str | None = Field(
        description="Pace alvo do passo no formato m:ss/km (ex.: 6:00/km; caminhada ~10:00/km). Preencha em TODOS "
        "os passos, inclusive aquecimento e desaquecimento. Progressivo: 6:00 → 5:30/km."
    )
    zona_fc: str | None = Field(description='Zona e faixa em bpm, ex.: "Zona 2 (128-142 bpm)".')
    recuperacao: str | None


class PlanWorkout(BaseModel):
    data: str
    esporte: Literal["run", "trail_run", "treadmill"]
    tipo: str
    titulo: str = Field(description="Curto, ate ~5 palavras.")
    objetivo: str = Field(description="1 frase curta (ate ~12 palavras): a finalidade do treino.")
    motivo: str = Field(description="1 frase curta (ate ~15 palavras): por que este treino nesta semana.")
    intensidade: Literal["leve", "moderado", "forte"]
    distancia_km: float | None
    duracao_min: float | None
    ritmo: str | None
    gap: str | None
    zona_fc: str | None = Field(description='Zona e faixa em bpm, ex.: "Zona 2 (128-142 bpm)".')
    cadencia: str | None
    terreno: str | None
    metrica_prioritaria: str | None = Field(description='Se ritmo e FC discordarem: "Ritmo", "FC" ou "Tempo".')
    observacoes: str | None = Field(description="1 frase curta ou null.")
    passos: list[PlanStep]


_SHORT_LIST = "No maximo 2 itens, cada um com 1 frase curta. Lista vazia se nao houver."


class PlanEvaluation(BaseModel):
    positivos: list[str] = Field(description=_SHORT_LIST)
    fadiga: list[str] = Field(description=_SHORT_LIST)
    riscos: list[str] = Field(description=_SHORT_LIST)
    evolucao: list[str] = Field(description=_SHORT_LIST)


class PlanNextWeek(BaseModel):
    km_previsto: float | None
    sessoes: int
    estimulo_principal: str
    objetivo: str


class PlanAdjustCriteria(BaseModel):
    manter: list[str] = Field(description=_SHORT_LIST)
    reduzir: list[str] = Field(description=_SHORT_LIST)
    acelerar: list[str] = Field(description=_SHORT_LIST)
    interromper: list[str] = Field(description=_SHORT_LIST)


class PlanWeekOutlook(BaseModel):
    semana: int
    km_aproximado: float | None
    foco: str


class WeeklyPlanLLM(BaseModel):
    # Mesma entrada → mesmo plano (temperatura 0 em _call_gemini). Sem isso cada
    # clique em "Gerar plano da semana" trazia treinos diferentes.
    stable_output: ClassVar[bool] = True

    status: Literal["verde", "amarelo", "laranja", "vermelho"]
    status_justificativa: str = Field(description="1 frase (ate ~20 palavras) com os dados que levaram ao status.")
    resumo: str = Field(description="1 a 2 frases curtas: a leitura da semana e o plano.")
    avaliacao: PlanEvaluation
    proxima_semana: PlanNextWeek
    treinos: list[PlanWorkout]
    criterios_ajuste: PlanAdjustCriteria
    proximas_4_semanas: list[PlanWeekOutlook]


class RegeneratedDay(BaseModel):
    stable_output: ClassVar[bool] = True

    descanso: bool
    explicacao: str
    treino: PlanWorkout | None


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
        "contexto": tag_labels(act.checkin_tags),
        "efeito_aerobico": float(act.training_effect_aerobic) if act.training_effect_aerobic is not None else None,
        "beneficio": benefit_label(act.primary_benefit),
    }
    return {k: v for k, v in item.items() if v is not None}


def _watch_detail(act: Activity) -> dict:
    """O que o relogio mediu alem do basico (so atividades de FIT do Garmin)."""
    def f(v):
        return float(v) if v is not None else None

    effect = {
        "aerobico": f(act.training_effect_aerobic),
        "anaerobico": f(act.training_effect_anaerobic),
        "beneficio": benefit_label(act.primary_benefit),
    }
    dynamics = {
        "passada_m": f(act.avg_step_length_m),
        "oscilacao_vertical_cm": round(float(act.avg_vertical_oscillation_mm) / 10, 1) if act.avg_vertical_oscillation_mm else None,
        "proporcao_vertical_pct": f(act.avg_vertical_ratio_pct),
        "contato_com_solo_ms": f(act.avg_stance_time_ms),
    }
    out = {
        "efeito_treino": {k: v for k, v in effect.items() if v is not None} or None,
        "dinamica_de_corrida": {k: v for k, v in dynamics.items() if v is not None} or None,
        "temperatura_min_max_c": [f(act.min_temperature_c), f(act.max_temperature_c)] if act.max_temperature_c is not None else None,
        "fc_recuperacao_bpm": act.hr_recovery,
        "suor_estimado_ml": act.sweat_loss_ml,
        "minutos_andando": round(act.walk_time_s / 60, 1) if act.walk_time_s else None,
    }
    return {k: v for k, v in out.items() if v is not None}


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
        "objetivo_cadastrado": has_goal(memories),
        "perfil": {
            "tratamento": _address(profile),
            "peso_kg": float(profile.weight_kg) if profile and profile.weight_kg else None,
            "fc_repouso": profile.resting_hr if profile else None,
            "fc_max": profile.max_hr if profile else None,
            "zonas_fc_bpm": resolve_hr_zones(profile),
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


def has_goal(memories: list[dict]) -> bool:
    """Objetivo cadastrado, ou uma prova que ainda nao passou: treinar para ela ja
    e um objetivo, e pedir os dois confundia o atleta."""
    return any(
        m["tipo"] == "objetivo" or (m["tipo"] == "prova" and not m.get("quando", "").startswith("foi"))
        for m in memories
    )


_ADDRESS = {"F": "feminino", "M": "masculino"}


def _address(profile: AthleteProfile | None) -> str:
    """Como concordar as palavras com o atleta. Sem o dado, texto neutro."""
    return _ADDRESS.get(profile.sex if profile else None, "neutro")


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
            max_tokens=8192,
            system=system_blocks,
            messages=[{"role": "user", "content": user_content}],
            output_format=response_model,
        )
        return response.parsed_output, settings.anthropic_model

    response = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=8192,
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
# Semente fixa dos planos: junto com temperatura 0, o mesmo contexto da o mesmo plano.
_STABLE_SEED = 7
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
        stable = getattr(response_model, "stable_output", False)
        config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            response_schema=response_model,
            # planos: sem sorteio (chat e resumo seguem com a temperatura padrao)
            temperature=0.0 if stable else None,
            seed=_STABLE_SEED if stable else None,
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
        .order_by(*CHAT_ORDER_DESC)
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

    # Instantes explicitos: com o mesmo created_at, a ordem entre pergunta e resposta
    # no historico ficava ao acaso.
    now = datetime.now(UTC)
    db.add(CoachInteraction(user_id=user_id, kind="chat", role="user", content=message, created_at=now))
    db.add(
        CoachInteraction(
            user_id=user_id, kind="chat", role="assistant", content=reply, model_used=model_used,
            created_at=now + timedelta(microseconds=1),
        )
    )
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


def generate_analysis(db: Session, user_id: uuid.UUID) -> tuple[dict, str]:
    """Resumo da semana estruturado. Fica salvo como JSON no content do
    CoachInteraction (os resumos antigos, em markdown, continuam la)."""
    context = build_context(db, user_id)
    _require_sufficient_data(context)

    user_content = _ANALYSIS_INSTRUCTION.format(context=json.dumps(context, ensure_ascii=False))
    parsed, model_used = call_llm(SYSTEM_PROMPT, user_content, response_model=AnalysisLLM)
    summary = parsed.model_dump()
    summary["pontos"] = summary["pontos"][:3]
    summary["acoes"] = summary["acoes"][:3]

    content = json.dumps(summary, ensure_ascii=False)
    db.add(CoachInteraction(user_id=user_id, kind="analysis", role=None, content=content, model_used=model_used))
    db.commit()
    return summary, model_used


def parse_analysis(content: str) -> tuple[dict | None, str | None]:
    """(summary, report): resumo novo (JSON) ou antigo (markdown)."""
    try:
        data = json.loads(content)
    except ValueError:
        return None, content
    if isinstance(data, dict) and "status_frase" in data:
        return data, None
    return None, content


class PlanEditError(CoachError):
    """Pedido de edicao do plano que nao pode ser feito (treino passado, feito...)."""

    def __init__(self, code: str, message: str, status_code: int = 400):
        self.code = code
        self.status_code = status_code
        super().__init__(message)


class PlanConflictError(CoachError):
    """Mover um treino para um dia que ja tem outro treino."""

    def __init__(self, conflict: PlannedWorkout):
        self.conflict = conflict
        super().__init__("date_conflict")


def week_range(today: date | None = None) -> tuple[date, date]:
    """A semana do plano: os 7 dias a partir de hoje (gerou na segunda, comeca na segunda)."""
    start = today or date.today()
    return start, start + timedelta(days=6)


def _check_workout(w: PlanWorkout, status: str) -> None:
    if not w.objetivo.strip() or not w.motivo.strip():
        raise CoachPlanParseError(f"A Duni mandou o treino de {w.data} sem objetivo ou sem motivo.")
    if status == "vermelho" and w.intensidade == "forte":
        raise CoachPlanParseError(
            f"A Duni marcou recuperacao prioritaria (vermelho) e mesmo assim pos treino forte em {w.data}."
        )


def validate_weekly_plan(plan: WeeklyPlanLLM, start: date, end: date) -> list[PlanWorkout]:
    """Regras que o codigo garante (nao confia no modelo). Descarta treinos com
    data invalida, fora da semana ou repetida; recusa o plano (CoachPlanParseError)
    sem treino, sem descanso, com treino forte no vermelho ou sem objetivo/motivo."""
    valid: dict[date, PlanWorkout] = {}
    for w in plan.treinos:
        try:
            day = date.fromisoformat(w.data)
        except ValueError:
            continue
        if not (start <= day <= end) or day in valid:
            continue
        _check_workout(w, plan.status)
        valid[day] = w
    if not valid:
        raise CoachPlanParseError("A Duni nao mandou nenhum treino valido para a semana.")
    days = (end - start).days + 1
    if len(valid) >= days:
        raise CoachPlanParseError("A Duni montou a semana sem nenhum dia de descanso.")
    return [valid[d] for d in sorted(valid)]


def previous_week_load(analysis: dict) -> dict:
    """Carga da semana anterior, calculada pelo codigo (janela de 7 dias da analise)."""
    w7 = analysis.get("janelas", {}).get("7d", {})
    run = w7.get("corrida", {})
    intensity = analysis.get("distribuicao_intensidade_28d", {})
    return {
        "corrida_km": run.get("km"),
        "corrida_minutos": run.get("minutos"),
        "corridas": run.get("sessoes"),
        "treinos_total": w7.get("sessoes_total"),
        "longao_km": run.get("longao_km"),
        "ritmo_medio": run.get("ritmo_medio"),
        "caminhada_km": w7.get("caminhada", {}).get("km"),
        "complementar": w7.get("complementar", {}),
        "carga_interna_srpe": w7.get("carga_interna_srpe"),
        "pse_media": w7.get("pse_media"),
        "intensidade_28d_pct": intensity.get("percentual") if intensity.get("disponivel") else None,
    }


def _workout_fields(w: PlanWorkout) -> dict:
    """Colunas de planned_workouts a partir de um treino da Duni."""
    return {
        "date": date.fromisoformat(w.data),
        "sport": w.esporte,
        "title": w.titulo[:200],
        "description": w.objetivo,
        "objective": w.objetivo,
        "reason": w.motivo,
        "target_distance_m": round(w.distancia_km * 1000, 2) if w.distancia_km else None,
        "target_duration_s": round(w.duracao_min * 60) if w.duracao_min else None,
        "target_intensity": w.intensidade,
        "target_tss": None,
        "steps": [s.model_dump() for s in w.passos],
        "targets": {
            "tipo": w.tipo,
            "ritmo": w.ritmo,
            "gap": w.gap,
            "zona_fc": w.zona_fc,
            "cadencia": w.cadencia,
            "terreno": w.terreno,
            "metrica_prioritaria": w.metrica_prioritaria,
            "observacoes": w.observacoes,
        },
    }


def generate_weekly_plan(db: Session, user_id: uuid.UUID) -> tuple[WeeklyPlan, list[PlannedWorkout], str]:
    context = build_context(db, user_id)
    _require_sufficient_data(context)

    start, end = week_range()
    days = ", ".join(
        f"{_WEEKDAYS_PT[d.weekday()]} {d.isoformat()}" for d in (start + timedelta(days=i) for i in range(7))
    )
    # Com plano do objetivo, os treinos da semana ja existem: a Duni so detalha.
    goal = current_goal_plan(db, user_id, start)
    fixed = list(db.execute(
        select(PlannedWorkout)
        .where(
            PlannedWorkout.user_id == user_id,
            PlannedWorkout.goal_plan_id == goal.id,
            PlannedWorkout.status == "planned",
            PlannedWorkout.date >= start,
            PlannedWorkout.date <= end,
        )
        .order_by(PlannedWorkout.date)
    ).scalars()) if goal else []
    user_content = _WEEK_PLAN_INSTRUCTION.format(days=days, context=json.dumps(context, ensure_ascii=False))
    if fixed:
        user_content = _goal_week_block(goal, fixed) + "\n\n" + user_content
    parsed, model_used = call_llm(SYSTEM_PROMPT, user_content, response_model=WeeklyPlanLLM)
    workouts = validate_weekly_plan(parsed, start, end)
    # Dia que ja tem treino feito ou pulado nesta semana nao ganha outro (regerar no meio da semana).
    taken = set(db.execute(
        select(PlannedWorkout.date).where(
            PlannedWorkout.user_id == user_id,
            PlannedWorkout.status != "planned",
            PlannedWorkout.date >= start,
            PlannedWorkout.date <= end,
        )
    ).scalars())
    workouts = [w for w in workouts if date.fromisoformat(w.data) not in taken]

    db.execute(
        delete(PlannedWorkout).where(
            PlannedWorkout.user_id == user_id,
            PlannedWorkout.status == "planned",
            PlannedWorkout.goal_plan_id.is_(None),  # os do plano do objetivo sao detalhados, nao trocados
            PlannedWorkout.date >= start,
            PlannedWorkout.date <= end,
        )
    )
    plan = WeeklyPlan(
        user_id=user_id,
        week_start=start,
        week_end=end,
        status=parsed.status,
        status_reason=parsed.status_justificativa,
        report={
            "resumo": parsed.resumo,
            "carga_semana_anterior": previous_week_load(context["analise"]),
            "avaliacao": {k: v[:3] for k, v in parsed.avaliacao.model_dump().items()},
            "proxima_semana": parsed.proxima_semana.model_dump(),
            "criterios_ajuste": {k: v[:3] for k, v in parsed.criterios_ajuste.model_dump().items()},
            "proximas_4_semanas": [w.model_dump() for w in parsed.proximas_4_semanas[:4]],
        },
        model_used=model_used,
        prompt_version=settings.coach_prompt_version,
    )
    db.add(plan)
    db.flush()
    # O que ja foi feito ou pulado nesta semana passa para o plano novo (conta nos "feitos").
    db.execute(
        update(PlannedWorkout)
        .where(
            PlannedWorkout.user_id == user_id,
            PlannedWorkout.status != "planned",
            PlannedWorkout.date >= start,
            PlannedWorkout.date <= end,
        )
        .values(weekly_plan_id=plan.id)
    )

    if fixed:
        rows = _detail_goal_workouts(fixed, workouts, plan.id)
    else:
        batch_id = uuid.uuid4()
        rows = [
            PlannedWorkout(user_id=user_id, plan_batch_id=batch_id, weekly_plan_id=plan.id, **_workout_fields(w))
            for w in workouts
        ]
        db.add_all(rows)
    db.commit()
    return plan, rows, model_used


_GOAL_WEEK_INSTRUCTION = """PLANO DO OBJETIVO ({race}): esta e a semana {week} ({phase}).
Os treinos desta semana JA ESTAO DEFINIDOS e nao mudam: mesma data, mesmo tipo,
mesma distancia. Em "treinos", devolva EXATAMENTE estas datas, uma por linha
abaixo, e so detalhe cada uma (passos, ritmo, FC, objetivo, motivo). Nenhum
treino em outra data.
{lines}"""


def _goal_week_block(goal: GoalPlan, fixed: list[PlannedWorkout]) -> str:
    week = next((w for w in goal.weeks if w["inicio"] <= fixed[0].date.isoformat() <= w["fim"]), None)
    lines = "\n".join(
        f"- {w.date.isoformat()}: {(w.targets or {}).get('tipo', w.title)}, {float(w.target_distance_m or 0) / 1000:g} km, "
        f"ritmo {(w.targets or {}).get('ritmo', '-')}, FC {(w.targets or {}).get('zona_fc', '-')}"
        for w in fixed
    )
    return _GOAL_WEEK_INSTRUCTION.format(
        race=f"{goal.race_name} em {goal.race_date.isoformat()}",
        week=week["semana"] if week else "?",
        phase=goal_plan.PHASE_LABEL.get(week["fase"], week["fase"]) if week else "?",
        lines=lines,
    )


def _detail_goal_workouts(fixed: list[PlannedWorkout], workouts: list[PlanWorkout], weekly_plan_id: uuid.UUID) -> list[PlannedWorkout]:
    """Poe o detalhe da Duni nos treinos do plano do objetivo. Data, tipo e distancia
    ficam os do objetivo, mesmo que a IA mande outros; treino em outra data e ignorado."""
    by_date = {date.fromisoformat(w.data): w for w in workouts}
    for row in fixed:
        row.weekly_plan_id = weekly_plan_id
        w = by_date.get(row.date)
        if w is None:
            continue  # a Duni pulou este dia: fica o treino do objetivo, sem passo a passo
        f = _workout_fields(w)
        kind = (row.targets or {}).get("tipo")
        row.title = f["title"]
        row.objective = f["objective"]
        row.reason = f["reason"]
        row.steps = f["steps"]
        row.targets = {**f["targets"], "tipo": kind or f["targets"]["tipo"]}
        row.target_duration_s = f["target_duration_s"] or row.target_duration_s
        row.updated_at = datetime.now(UTC)
    return fixed


def current_weekly_plan(db: Session, user_id: uuid.UUID, today: date | None = None) -> WeeklyPlan | None:
    """O plano mais recente que ainda nao terminou."""
    today = today or date.today()
    return db.execute(
        select(WeeklyPlan)
        .where(WeeklyPlan.user_id == user_id, WeeklyPlan.kind == "principal", WeeklyPlan.week_end >= today)
        .order_by(WeeklyPlan.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()


def _editable_workout(db: Session, user_id: uuid.UUID, workout_id: uuid.UUID) -> PlannedWorkout:
    workout = db.execute(
        select(PlannedWorkout).where(PlannedWorkout.id == workout_id, PlannedWorkout.user_id == user_id)
    ).scalar_one_or_none()
    if workout is None:
        raise PlanEditError("not_found", "Treino nao encontrado.", 404)
    if workout.status != "planned" or workout.date < date.today():
        raise PlanEditError("not_editable", "So da para mudar treino ainda nao feito, de hoje em diante.")
    return workout


def _workout_brief(w: PlannedWorkout) -> dict:
    return {
        "data": w.date.isoformat(),
        "titulo": w.title,
        "intensidade": w.target_intensity,
        "km": float(w.target_distance_m) / 1000 if w.target_distance_m else None,
        "objetivo": w.objective or w.description,
    }


def regenerate_workout(
    db: Session, user_id: uuid.UUID, workout_id: uuid.UUID, reason: str
) -> tuple[PlannedWorkout | None, str, str]:
    """Troca o treino de um dia pelo motivo do atleta. Devolve o treino novo (ou
    None, se a Duni decidiu por descanso e o treino foi apagado), a explicacao
    dela e o modelo usado."""
    workout = _editable_workout(db, user_id, workout_id)
    plan = db.get(WeeklyPlan, workout.weekly_plan_id) if workout.weekly_plan_id else None
    status = plan.status if plan else "sem plano semanal"
    week = db.execute(
        select(PlannedWorkout)
        .where(
            PlannedWorkout.user_id == user_id,
            PlannedWorkout.id != workout.id,
            PlannedWorkout.date >= workout.date - timedelta(days=3),
            PlannedWorkout.date <= workout.date + timedelta(days=3),
        )
        .order_by(PlannedWorkout.date)
    ).scalars().all()

    context = build_context(db, user_id)
    user_content = _REGENERATE_INSTRUCTION.format(
        day=f"{_WEEKDAYS_PT[workout.date.weekday()]} {workout.date.isoformat()}",
        reason=reason.strip(),
        current=json.dumps(_workout_brief(workout), ensure_ascii=False),
        week=json.dumps([_workout_brief(w) for w in week], ensure_ascii=False),
        status=status,
        context=json.dumps(context, ensure_ascii=False),
    )
    parsed, model_used = call_llm(SYSTEM_PROMPT, user_content, response_model=RegeneratedDay)

    if parsed.descanso or parsed.treino is None:
        db.delete(workout)
        db.commit()
        return None, parsed.explicacao, model_used

    new = parsed.treino.model_copy(update={"data": workout.date.isoformat()})  # o dia nao muda
    _check_workout(new, plan.status if plan else "")
    for field, value in _workout_fields(new).items():
        setattr(workout, field, value)
    workout.targets = {**(workout.targets or {}), "ajuste_pedido": reason.strip()}
    workout.updated_at = datetime.now(UTC)
    db.commit()
    return workout, parsed.explicacao, model_used


class WorkoutReviewLLM(BaseModel):
    # mesma pergunta sobre o mesmo treino: mesma analise
    stable_output: ClassVar[bool] = True

    veredito: Literal["manter", "ajustar", "descanso"]
    explicacao: str = Field(description="1 a 2 frases curtas: por que manter, ajustar ou descansar, citando os dados.")
    pontos: list[str] = Field(description="Ate 3 pontos curtos que pesaram (carga, dor, fase do plano). Lista vazia se nada.")
    sugestao: PlanWorkout | None = Field(
        description="So com veredito ajustar: o treino ajustado para o MESMO dia, com todos os campos e passos. Senao null."
    )


def _review_inputs(db: Session, user_id: uuid.UUID, workout: PlannedWorkout) -> tuple[str, list[PlannedWorkout], str]:
    plan = db.get(WeeklyPlan, workout.weekly_plan_id) if workout.weekly_plan_id else None
    week = db.execute(
        select(PlannedWorkout)
        .where(
            PlannedWorkout.user_id == user_id,
            PlannedWorkout.id != workout.id,
            PlannedWorkout.date >= workout.date - timedelta(days=3),
            PlannedWorkout.date <= workout.date + timedelta(days=3),
        )
        .order_by(PlannedWorkout.date)
    ).scalars().all()
    goal = db.get(GoalPlan, workout.goal_plan_id) if workout.goal_plan_id else None
    goal_line = ""
    if goal:
        wk = next((w for w in goal.weeks if w["inicio"] <= workout.date.isoformat() <= w["fim"]), None)
        if wk:
            goal_line = (
                f"Plano do objetivo: {goal.race_name} em {goal.race_date.isoformat()}; esta e a semana "
                f"{wk['semana']} ({goal_plan.PHASE_LABEL.get(wk['fase'], wk['fase'])}"
                f"{', alivio' if wk['alivio'] else ''}), {wk['km']} km na semana."
            )
    return (plan.status if plan else "sem plano semanal"), list(week), goal_line


def review_workout(db: Session, user_id: uuid.UUID, workout_id: uuid.UUID, question: str | None = None) -> dict:
    """A Duni analisa o treino do dia contra os dados de agora. Nao muda nada: a
    sugestao so vale se o atleta aplicar (apply_review)."""
    workout = _editable_workout(db, user_id, workout_id)
    status, week, goal_line = _review_inputs(db, user_id, workout)
    asked = (question or "").strip()
    user_content = _REVIEW_INSTRUCTION.format(
        day=f"{_WEEKDAYS_PT[workout.date.weekday()]} {workout.date.isoformat()}",
        question=f'O atleta discorda ou tem duvida: "{asked}"' if asked else "",
        current=json.dumps(_workout_brief(workout), ensure_ascii=False),
        week=json.dumps([_workout_brief(w) for w in week], ensure_ascii=False),
        status=status,
        goal=goal_line,
        context=json.dumps(build_context(db, user_id), ensure_ascii=False),
    )
    parsed, model_used = call_llm(SYSTEM_PROMPT, user_content, response_model=WorkoutReviewLLM)

    suggestion = None
    if parsed.veredito == "ajustar" and parsed.sugestao is not None:
        suggestion = parsed.sugestao.model_copy(update={"data": workout.date.isoformat()})  # o dia nao muda
        _check_workout(suggestion, status)
    preview = None
    if suggestion is not None:
        preview = {k: (v.isoformat() if isinstance(v, date) else v) for k, v in _workout_fields(suggestion).items()}
    return {
        "verdict": parsed.veredito,
        "explanation": parsed.explicacao,
        "points": [p for p in parsed.pontos if p.strip()][:3],
        "suggestion": suggestion.model_dump() if suggestion else None,
        "preview": preview,
        "model_used": model_used,
    }


def apply_review(
    db: Session, user_id: uuid.UUID, workout_id: uuid.UUID, verdict: str, suggestion: dict | None, explanation: str,
) -> PlannedWorkout | None:
    """Aplica o que a analise sugeriu: troca o treino (mesmo dia) ou vira descanso."""
    workout = _editable_workout(db, user_id, workout_id)
    if verdict == "descanso":
        db.delete(workout)
        db.commit()
        return None
    try:
        new = PlanWorkout.model_validate(suggestion or {})
    except ValueError as e:
        raise PlanEditError("invalid_suggestion", "A sugestão veio incompleta. Peça a análise de novo.", 422) from e
    new = new.model_copy(update={"data": workout.date.isoformat()})
    plan = db.get(WeeklyPlan, workout.weekly_plan_id) if workout.weekly_plan_id else None
    try:
        _check_workout(new, plan.status if plan else "")
    except CoachPlanParseError as e:
        raise PlanEditError("invalid_suggestion", str(e), 422) from e
    for name, value in _workout_fields(new).items():
        setattr(workout, name, value)
    workout.targets = {**(workout.targets or {}), "ajuste_analise": explanation.strip()[:300]}
    workout.updated_at = datetime.now(UTC)
    db.commit()
    return workout


def move_workout(
    db: Session,
    user_id: uuid.UUID,
    workout_id: uuid.UUID,
    new_date: date,
    on_conflict: Literal["error", "swap", "keep_both"] = "error",
) -> PlannedWorkout:
    """Muda o treino de dia. Se o dia ja tem treino: 'error' avisa
    (PlanConflictError), 'swap' troca os dois de dia, 'keep_both' deixa os dois."""
    workout = _editable_workout(db, user_id, workout_id)
    if new_date < date.today():
        raise PlanEditError("past_date", "Nao da para mover um treino para um dia que ja passou.")
    if new_date == workout.date:
        return workout
    conflict = db.execute(
        select(PlannedWorkout).where(
            PlannedWorkout.user_id == user_id,
            PlannedWorkout.id != workout.id,
            PlannedWorkout.date == new_date,
        )
    ).scalars().first()
    if conflict is not None:
        if on_conflict == "error":
            raise PlanConflictError(conflict)
        if on_conflict == "swap":
            if conflict.status != "planned":
                raise PlanEditError("not_swappable", "O treino desse dia ja foi feito ou marcado; nao da para trocar.")
            conflict.date = workout.date
            conflict.updated_at = datetime.now(UTC)
    workout.date = new_date
    workout.updated_at = datetime.now(UTC)
    db.commit()
    return workout


# ── comentario pos-treino (Fase 8) ──────────────────────────────────────────

_ACTIVITY_INSTRUCTION = """Comente este treino do atleta em markdown, em ate ~120
palavras, com 3 blocos curtos (pule o que nao tiver dado):
**Como foi**: 1 ou 2 frases com distancia, tempo, ritmo e FC; se havia treino
planejado para o dia, diga se bateu com ele.
**O que chamou atencao**: ate 2 pontos. Olhe as voltas (ritmo e GAP constantes
ou caindo, FC subindo, deriva, cadencia contra a habitual), o tempo por zona, a
sessao equivalente (melhorou ou custou mais) e o check-in (esforco marcado,
sensacao, dor, contexto). Em subida, julgue pelo GAP. Sem check-in, peca para ele preencher. Dor
que persiste ou piora: avaliacao profissional.
**Proximo passo**: 1 ou 2 recomendacoes praticas para os proximos dias.

Nao invente numero. Use so os dados abaixo.

Dados do treino (JSON):
{context}"""


class ActivityNotFoundError(CoachError):
    pass


def _lap_detail(lap: ActivityLap) -> dict:
    item = {
        "volta": lap.lap_index + 1,
        "km": round(float(lap.distance_m) / 1000, 2) if lap.distance_m else None,
        "tempo": _fmt_duration(lap.duration_s) if lap.duration_s else None,
        "ritmo": _fmt_pace(lap.avg_pace_s_per_km),
        "gap": _fmt_pace(lap.gap_pace_s_per_km),
        "fc_media": lap.avg_hr,
        "fc_max": lap.max_hr,
        "cadencia_ppm": lap.avg_cadence,
        "subida_m": round(float(lap.elevation_gain_m)) if lap.elevation_gain_m else None,
    }
    return {k: v for k, v in item.items() if v is not None}


def _zone_minutes(db: Session, act: Activity, profile: AthleteProfile | None) -> dict | None:
    zones = resolve_hr_zones(profile)
    if zones is None or not act.avg_hr:
        return None
    points = [
        PointLike(elapsed_time_s=t, hr=hr)
        for t, hr in db.execute(
            select(ActivityPoint.elapsed_time_s, ActivityPoint.hr)
            .where(ActivityPoint.activity_id == act.id)
            .order_by(ActivityPoint.elapsed_time_s)
        )
    ]
    buckets = hr_zone_distribution(points, zones)
    if sum(b.seconds for b in buckets) <= 0:
        return None
    return {f"Z{b.zone}": round(b.seconds / 60, 1) for b in buckets}


def _load_activity(db: Session, user_id: uuid.UUID, activity_id: uuid.UUID) -> Activity:
    act = db.execute(
        select(Activity).where(
            Activity.id == activity_id, Activity.user_id == user_id, Activity.deleted_at.is_(None)
        )
    ).scalar_one_or_none()
    if act is None:
        raise ActivityNotFoundError("Atividade nao encontrada.")
    return act


def activity_context(db: Session, user_id: uuid.UUID, act: Activity) -> dict:
    """O treino e o que cerca ele: voltas, zonas, check-in, o planejado do dia,
    a sessao equivalente e a analise ate aquele dia (nao ate hoje)."""
    day = act.start_time.astimezone(ZoneInfo(act.timezone or "America/Sao_Paulo")).date()
    profile = db.execute(select(AthleteProfile).where(AthleteProfile.user_id == user_id)).scalar_one_or_none()
    analysis = build_analysis(db, user_id, day)

    laps = db.execute(
        select(ActivityLap).where(ActivityLap.activity_id == act.id).order_by(ActivityLap.lap_index).limit(60)
    ).scalars().all()
    planned = db.execute(
        select(PlannedWorkout)
        .where(
            PlannedWorkout.user_id == user_id,
            (PlannedWorkout.activity_id == act.id) | (PlannedWorkout.date == day),
        )
        .order_by(PlannedWorkout.date)
    ).scalars().all()

    detail = {**_activity_detail(act), **_watch_detail(act)}
    if act.tss:
        detail["tss"] = round(float(act.tss))
    if act.avg_temperature_c is not None:
        detail["temperatura_c"] = float(act.avg_temperature_c)

    return {
        "atividade": detail,
        "minutos_por_zona_fc": _zone_minutes(db, act, profile),
        "voltas": [_lap_detail(lap) for lap in laps],
        "planejado_para_o_dia": [
            {**_workout_brief(w), "status": w.status, "passos": w.steps, "alvos": w.targets} for w in planned
        ],
        "sessao_equivalente": [
            e for e in analysis.get("sessoes_equivalentes", []) if e["atual"]["data"] == day.isoformat()
        ],
        "cadencia_habitual": analysis.get("cadencia_habitual"),
        "semana_ate_o_dia": {k: analysis["janelas"][k] for k in ("7d", "28d")} if "janelas" in analysis else None,
        "sinais_de_fadiga_ate_o_dia": analysis.get("sinais_de_fadiga"),
        "memorias": memories_context(db, user_id, today=day),
        "perfil": {
            "tratamento": _address(profile),
            "fc_repouso": profile.resting_hr if profile else None,
            "fc_max": profile.max_hr if profile else None,
            "zonas_fc_bpm": resolve_hr_zones(profile),
        },
    }


def generate_activity_comment(db: Session, user_id: uuid.UUID, activity_id: uuid.UUID) -> CoachInteraction:
    """Comentario da Duni sobre um treino. So sob demanda (nunca no import: um
    import em lote queimaria a cota do free tier)."""
    act = _load_activity(db, user_id, activity_id)
    context = activity_context(db, user_id, act)
    user_content = _ACTIVITY_INSTRUCTION.format(context=json.dumps(context, ensure_ascii=False))
    text, model_used = call_llm(SYSTEM_PROMPT, user_content)

    row = CoachInteraction(
        user_id=user_id, kind="activity", role="assistant", content=text, model_used=model_used, activity_id=act.id
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def latest_activity_comment(db: Session, user_id: uuid.UUID, activity_id: uuid.UUID) -> CoachInteraction | None:
    _load_activity(db, user_id, activity_id)
    return db.execute(
        select(CoachInteraction)
        .where(
            CoachInteraction.user_id == user_id,
            CoachInteraction.kind == "activity",
            CoachInteraction.activity_id == activity_id,
        )
        .order_by(CoachInteraction.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()


# ── plano do objetivo ──────────────────────────────────────────────────────

_GOAL_MIN_DAYS = 14  # menos que isso nao da para periodizar
_VDOT_RECORDS = {"fastest_5k": 5000, "fastest_10k": 10000, "fastest_21k": 21097, "fastest_42k": 42195}
_DEFAULT_VDOT = 33.0

_PHASE_FOCUS_DEFAULT = {
    "base": "Volume leve e constância para o corpo aguentar o que vem.",
    "construcao": "Longões maiores e treinos de limiar.",
    "pico": "Ritmo de prova e os longões mais longos.",
    "polimento": "Menos volume para chegar descansado na prova.",
}
_OBJECTIVE_DEFAULT = {
    "rodagem leve": "Somar volume leve sem cansar.",
    "regenerativo": "Soltar as pernas e recuperar.",
    "longão": "Resistência para a distância da prova.",
    "longão progressivo": "Resistência terminando mais forte.",
    "longão com ritmo de prova": "Treinar o ritmo de prova cansado.",
    "progressivo": "Acelerar aos poucos sem estourar.",
    "fartlek": "Estímulos curtos de velocidade, sem pressão.",
    "limiar": "Subir o ritmo que você sustenta por mais tempo.",
    "intervalado": "Melhorar a velocidade e o fôlego.",
    "ritmo de prova": "Acostumar o corpo ao ritmo da prova.",
    "prova": "Dia da prova: correr o plano.",
}


class GoalPlanSlotLLM(BaseModel):
    data: str
    tipo: str = Field(description="Exatamente uma das opcoes listadas para esta data.")
    titulo: str = Field(description="Curto, ate ~5 palavras.")
    objetivo: str = Field(description="1 frase curta (ate ~12 palavras): a finalidade do treino.")


class GoalPlanPhaseLLM(BaseModel):
    fase: Literal["base", "construcao", "pico", "polimento"]
    foco: str = Field(description="1 frase curta (ate ~15 palavras): o foco da fase para este atleta.")


class GoalPlanLLM(BaseModel):
    stable_output: ClassVar[bool] = True

    resumo: str = Field(description="1 a 2 frases curtas: como o plano leva o atleta ate a prova.")
    fases: list[GoalPlanPhaseLLM]
    treinos: list[GoalPlanSlotLLM]


_GOAL_PLAN_INSTRUCTION = """Monte o plano do atleta ate a prova {race}.
O esqueleto abaixo foi calculado pelo sistema (volume seguro, semanas de alivio,
polimento) e NAO muda: datas, papel e km de cada treino sao fixos.

Sua parte, para CADA linha do esqueleto (mesma data):
- tipo: escolha UMA das opcoes da linha. Varie os treinos de qualidade entre as
  semanas. Considere lesoes, dores e o historico do contexto (com dor, prefira o
  tipo mais leve).
- titulo curto e objetivo em 1 frase.
Depois: resumo do plano (1 a 2 frases) e o foco de cada fase presente (1 frase).
Nao escreva ritmo, FC nem distancia: o sistema calcula.

O que o sistema leu dos ultimos 6 meses (o ultimo mes pesa mais; use isto nas
escolhas e no resumo, sem repetir numeros que nao estejam aqui):
{factors}

Semanas dos ultimos 6 meses (corrida; caminhada fora):
{history}

Paces do atleta (calculados pelo sistema): {paces}

Esqueleto (data | semana | fase | papel | km | opcoes de tipo):
{slots}

Contexto do atleta:
{context}"""


def _goal_race(db: Session, user_id: uuid.UUID, today: date) -> tuple[AthleteMemory, float]:
    """A prova alvo: a mais longa entre as provas futuras com data (empate: a mais proxima)."""
    rows = db.execute(
        select(AthleteMemory).where(
            AthleteMemory.user_id == user_id,
            AthleteMemory.active.is_(True),
            AthleteMemory.kind == "prova",
            AthleteMemory.event_date.is_not(None),
            AthleteMemory.event_date >= today,
        )
    ).scalars().all()
    races = [(m, km) for m in rows if (km := goal_plan.race_distance_km(m.content))]
    if not races:
        raise PlanEditError(
            "no_goal_race",
            "Cadastre a prova com a data em \"O que a Duni sabe de você\" (ex.: Maratona do Rio, 30/05/2027).",
            422,
        )
    memory, km = sorted(races, key=lambda r: (-r[1], r[0].event_date))[0]
    if (memory.event_date - today).days < _GOAL_MIN_DAYS:
        raise PlanEditError("race_too_close", "A prova é em menos de 2 semanas: use o plano da semana.", 422)
    return memory, km


@dataclass
class _GoalSetup:
    """Tudo o que os 6 meses decidem no plano, e por que (factors vai para a tela)."""

    base_km: float
    base_long_km: float
    ramp: float
    comeback_km: float | None
    long_step: float
    peak_km: float | None
    vdot: float
    layout: dict[int, str] | None
    history: training_history.History
    factors: list[dict] = dc_field(default_factory=list)


_MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]


def _num(x: float) -> str:
    return f"{x:.0f}" if abs(x - round(x)) < 0.05 else f"{x:.1f}".replace(".", ",")


def _goal_setup(db: Session, user_id: uuid.UUID, today: date, race_km: float, days_per_week: int) -> _GoalSetup:
    """Le os ultimos 6 meses: o ultimo mes decide de onde o plano parte; o historico
    decide ate onde sobe, o nivel e o cuidado (pausas, dor)."""
    profile = db.execute(select(AthleteProfile).where(AthleteProfile.user_id == user_id)).scalar_one_or_none()
    since = datetime.combine(today - timedelta(weeks=training_history.HISTORY_WEEKS + 1), datetime.min.time(), tzinfo=UTC)
    acts = db.execute(
        select(Activity).where(
            Activity.user_id == user_id,
            Activity.deleted_at.is_(None),
            Activity.sport.in_([s for s, g in _SPORT_GROUPS.items() if g == "run"]),
            Activity.start_time >= since,
        )
    ).scalars().all()
    runs = [
        training_history.Run(
            day=a.start_time.date(),
            km=float(a.distance_m) / 1000,
            seconds=float(a.moving_time_s or a.duration_s),
            avg_hr=a.avg_hr,
            pain_level=a.pain_level,
            pain_location=a.pain_location,
        )
        for a in acts
        if a.distance_m
    ]
    hist = training_history.summarize(runs, today, profile.max_hr if profile else None, profile.resting_hr if profile else None)

    memories = db.execute(
        select(AthleteMemory).where(AthleteMemory.user_id == user_id, AthleteMemory.active.is_(True))
    ).scalars().all()
    injuries = [m.content for m in memories if m.kind == "lesao"]
    pain = bool(hist.pain) or bool(injuries)

    base_km = max(hist.recent_km, 0.85 * hist.last_week_km, 8.0)
    comeback = hist.peak_block_km >= 1.8 * base_km and hist.longest_pause >= 4
    comeback_km = round(0.6 * hist.peak_block_km, 1) if comeback and not pain else None
    ramp = 0.08 if pain else 0.10
    long_step = 2.5 if comeback and not pain else 2.0
    peak_cap = hist.peak_block_km * 1.1 if hist.peak_block_km >= 20 else None

    record_rows = db.execute(
        select(PersonalRecord.record_type, PersonalRecord.value, PersonalRecord.achieved_at).where(
            PersonalRecord.user_id == user_id, PersonalRecord.record_type.in_(list(_VDOT_RECORDS)),
        )
    ).all()
    records = [(float(v), _VDOT_RECORDS[t], at.date()) for t, v, at in record_rows]
    vdot = training_history.blended_vdot(hist.vdot_recent, records, hist, today)
    if vdot is None:
        recent = [w for w in hist.weeks[-4:] if w.km]
        pace = sum(w.seconds for w in recent) / sum(w.km for w in recent) if recent else None
        vdot = round(goal_plan.vdot_from_easy_pace(pace), 1) if pace else _DEFAULT_VDOT

    days = training_history.preferred_days([m.content for m in memories if m.kind == "disponibilidade"])
    layout = goal_plan.layout_from_days(days, days_per_week)

    f: list[dict] = []
    f.append({"tema": "Último mês", "texto": (
        f"Média de {_num(hist.recent_km)} km por semana (a última com {_num(hist.last_week_km)} km), "
        f"{_num(hist.runs_per_week)} corridas por semana e longão de {_num(hist.recent_longest)} km. O plano parte daqui."
    )})
    if hist.peak_block_km >= 15 and hist.peak_block_start:
        m = hist.peak_block_start
        f.append({"tema": "Histórico de 6 meses", "texto": (
            f"Você já sustentou {_num(hist.peak_block_km)} km por semana ({_MONTHS_PT[m.month - 1]}/{m.year % 100}) e fez "
            f"longão de {_num(hist.longest_6m)} km. Isso define até onde o plano sobe, sem passar disso por muito."
        )})
    if hist.longest_pause >= 3:
        f.append({"tema": "Pausa", "texto": (
            f"{hist.longest_pause} semanas seguidas quase parado. "
            + (f"Como o corpo já conhece volume alto, a volta sobe mais rápido até ~{_num(comeback_km)} km por semana."
               if comeback_km else "A volta é gradual, sem tentar recuperar o volume antigo de uma vez.")
        )})
    if pain:
        places = sorted({loc for _d, _lv, loc in hist.pain if loc} | set(injuries))
        worst = max((lv for _d, lv, _loc in hist.pain), default=None)
        f.append({"tema": "Dor", "texto": (
            f"Dor recente{': ' + ', '.join(places) if places else ''}{f' (até {worst}/10)' if worst else ''}. "
            "O volume sobe no máximo 8% por semana e os treinos fortes só entram depois da base. "
            "Se a dor passar de 3/10 ou piorar, reduza e procure um fisioterapeuta."
        )})
    else:
        f.append({"tema": "Subida", "texto": f"Volume sobe até {round(ramp * 100)}% por semana, com alívio a cada 4 semanas."})
    level = "pelo seu ritmo e FC no último mês" if hist.vdot_recent else "pelos seus treinos recentes"
    if hist.vdot_recent and records:
        level = "70% pelo seu ritmo e FC no último mês e 30% pelos recordes (descontando a pausa)"
    f.append({"tema": "Nível", "texto": (
        f"VDOT {_num(vdot)}, {level}. Maratona prevista hoje: "
        f"{_fmt_duration(goal_plan.race_time_s(vdot, 42.195))}; o plano mira melhorar até a prova."
        if race_km > 40 else f"VDOT {_num(vdot)}, {level}."
    )})
    if layout:
        names = [training_history.WEEKDAY_NAMES[d] for d in layout]
        long_day = training_history.WEEKDAY_NAMES[next(d for d, r in layout.items() if r == "longao")]
        f.append({"tema": "Dias", "texto": f"Treinos de {', '.join(names[:-1])} e {names[-1]}, como você contou; longão no {long_day}."})
    prefs = [m.content for m in memories if m.kind == "preferencia"]
    if prefs:
        f.append({"tema": "Preferências", "texto": "; ".join(prefs) + ". Entram nas escolhas de treino, respeitando a fase e a dor."})

    return _GoalSetup(
        base_km=base_km, base_long_km=max(hist.recent_longest, 5.0), ramp=ramp, comeback_km=comeback_km,
        long_step=long_step, peak_km=peak_cap, vdot=vdot, layout=layout, history=hist, factors=f,
    )


def current_goal_plan(db: Session, user_id: uuid.UUID, today: date | None = None) -> GoalPlan | None:
    today = today or date.today()
    return db.execute(
        select(GoalPlan)
        .where(GoalPlan.user_id == user_id, GoalPlan.active.is_(True), GoalPlan.race_date >= today)
        .order_by(GoalPlan.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()


def generate_goal_plan(
    db: Session, user_id: uuid.UUID, days_per_week: int = 3, today: date | None = None,
) -> tuple[GoalPlan, list[PlannedWorkout], str]:
    """Esqueleto pelo codigo + tipo/titulo/objetivo pela Duni. Refaz de hoje em diante:
    treinos feitos ou pulados ficam; os planejados dai para frente sao trocados."""
    today = today or date.today()
    memory, race_km = _goal_race(db, user_id, today)
    context = build_context(db, user_id)
    _require_sufficient_data(context)

    setup = _goal_setup(db, user_id, today, race_km, days_per_week)
    vdot = setup.vdot
    p = goal_plan.paces(vdot, race_km)
    zones = resolve_hr_zones(db.execute(select(AthleteProfile).where(AthleteProfile.user_id == user_id)).scalar_one_or_none())
    weeks = goal_plan.build_skeleton(
        today, memory.event_date, race_km, days_per_week, setup.base_km, setup.base_long_km,
        ramp=setup.ramp, comeback_km=setup.comeback_km, long_step=setup.long_step,
        peak_km=setup.peak_km, layout=setup.layout,
    )
    slots = [(w, s) for w in weeks for s in w.slots if s.date >= today]

    lines = "\n".join(
        f"{s.date.isoformat()} | {w.index} | {w.phase}{' (alivio)' if w.cutback else ''} | {s.role} | {s.km:g} km | "
        + ", ".join(s.options)
        for w, s in slots
    )
    paces_txt = ", ".join(f"{k}: {goal_plan.fmt_pace(v)}/km" for k, v in p.items())
    history_txt = "\n".join(
        f"{w.start.isoformat()}: {w.km:.1f} km, {w.runs} corridas, maior {w.longest:.1f} km"
        + (f", pace {goal_plan.fmt_pace(w.pace)}/km" if w.pace else "")
        + (f", FC {w.avg_hr}" if w.avg_hr else "")
        for w in setup.history.weeks
    )
    user_content = _GOAL_PLAN_INSTRUCTION.format(
        race=f"{memory.content} em {memory.event_date.isoformat()} ({race_km:g} km)",
        factors="\n".join(f"- {x['tema']}: {x['texto']}" for x in setup.factors),
        history=history_txt,
        paces=paces_txt,
        slots=lines,
        context=json.dumps(context, ensure_ascii=False),
    )
    parsed, model_used = call_llm(SYSTEM_PROMPT, user_content, response_model=GoalPlanLLM)
    chosen = {t.data: t for t in parsed.treinos}
    focus = {f.fase: f.foco for f in parsed.fases}

    # dia que ja tem treino feito/pulado nao ganha outro; planejados de hoje em diante saem
    taken = set(db.execute(
        select(PlannedWorkout.date).where(
            PlannedWorkout.user_id == user_id, PlannedWorkout.status != "planned", PlannedWorkout.date >= today,
        )
    ).scalars())
    db.execute(
        delete(PlannedWorkout).where(
            PlannedWorkout.user_id == user_id, PlannedWorkout.status == "planned", PlannedWorkout.date >= today,
        )
    )
    db.execute(update(GoalPlan).where(GoalPlan.user_id == user_id, GoalPlan.active.is_(True)).values(active=False))

    phases = []
    for name in goal_plan.PHASES:
        ws = [w for w in weeks if w.phase == name]
        if ws:
            phases.append({
                "fase": name,
                "inicio": ws[0].start.isoformat(),
                "fim": ws[-1].end.isoformat(),
                "foco": focus.get(name) or _PHASE_FOCUS_DEFAULT[name],
            })
    plan = GoalPlan(
        user_id=user_id,
        memory_id=memory.id,
        race_name=memory.content,
        race_date=memory.event_date,
        race_distance_km=race_km,
        days_per_week=days_per_week,
        vdot=vdot,
        summary=parsed.resumo,
        phases=phases,
        weeks=[
            {"semana": w.index, "inicio": w.start.isoformat(), "fim": w.end.isoformat(), "fase": w.phase,
             "km": w.km, "longao_km": w.long_km, "alivio": w.cutback}
            for w in weeks
        ],
        paces={k: round(v) for k, v in p.items()},
        analysis=setup.factors,
        model_used=model_used,
        prompt_version=settings.coach_prompt_version,
    )
    db.add(plan)
    db.flush()

    batch_id = uuid.uuid4()
    rows = []
    for w, s in slots:
        if s.date in taken:
            continue
        pick = chosen.get(s.date.isoformat())
        kind = pick.tipo.strip().lower() if pick and pick.tipo.strip().lower() in s.options else s.options[0]
        if pick and pick.tipo.strip().lower() != kind:
            pick = None  # tipo fora das opcoes: titulo e objetivo dela nao valem para o padrao
        t = goal_plan.workout_targets(kind, s.km, p, zones)
        rows.append(PlannedWorkout(
            user_id=user_id,
            plan_batch_id=batch_id,
            goal_plan_id=plan.id,
            date=s.date,
            sport="run",
            title=(pick.titulo.strip() if pick and pick.titulo.strip() else kind.capitalize())[:200],
            target_distance_m=s.km * 1000,
            target_duration_s=t["duracao_s"],
            target_intensity=t["intensidade"],
            objective=pick.objetivo.strip() if pick and pick.objetivo.strip() else _OBJECTIVE_DEFAULT.get(kind),
            reason=f"Semana {w.index} · {goal_plan.PHASE_LABEL[w.phase]}{' (alívio)' if w.cutback else ''}",
            targets={"tipo": kind, "ritmo": t["ritmo"], "zona_fc": t["zona_fc"], "metrica_prioritaria": "FC"},
        ))
    db.add_all(rows)
    db.commit()
    return plan, rows, model_used


# ── plano da semana "livre": o que a Duni faria AGORA, para comparar com o objetivo ──


class WeekComparisonDay(BaseModel):
    data: str
    escolha: Literal["objetivo", "semana"]
    motivo: str = Field(description="1 frase curta (ate ~12 palavras).")


class WeekComparison(BaseModel):
    recomenda: Literal["objetivo", "semana", "misturar"]
    explicacao: str = Field(description="1 a 2 frases curtas: qual seguir nesta semana e por que, citando os dados.")
    dias: list[WeekComparisonDay] = Field(description="Um item por dia em que os dois planos diferem.")


class FreeWeekLLM(WeeklyPlanLLM):
    comparacao: WeekComparison


_FREE_WEEK_INSTRUCTION = """PLANO DA SEMANA PELO ESTADO DE AGORA. Esqueca por um momento o plano
do objetivo: monte a semana que voce faria para este atleta HOJE, so pelo estado
atual (carga e treinos do ultimo mes, dor, check-ins, cansaco, dias disponiveis).
Pode coincidir ou nao com o objetivo.

Depois compare com o que o plano do objetivo manda para estes mesmos dias (abaixo)
e preencha "comparacao": qual voce recomenda seguir nesta semana (objetivo, semana
ou misturar), por que, e para cada dia em que os dois diferem, qual escolher.

Plano do objetivo para estes dias (JSON): {goal_week}

{base}"""


def _free_preview(w: PlanWorkout) -> dict:
    fields = _workout_fields(w)
    return {
        "id": f"livre-{w.data}", "status": "proposta", "activity_id": None, "target_tss": None,
        "description": fields.pop("description"),
        **{k: (v.isoformat() if isinstance(v, date) else v) for k, v in fields.items()},
    }


def current_free_week(db: Session, user_id: uuid.UUID, today: date | None = None) -> WeeklyPlan | None:
    today = today or date.today()
    return db.execute(
        select(WeeklyPlan)
        .where(WeeklyPlan.user_id == user_id, WeeklyPlan.kind == "livre", WeeklyPlan.week_end >= today)
        .order_by(WeeklyPlan.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()


def free_week_workouts(plan: WeeklyPlan) -> list[PlanWorkout]:
    return [PlanWorkout.model_validate(t) for t in (plan.report or {}).get("treinos", [])]


def generate_free_week(db: Session, user_id: uuid.UUID) -> tuple[WeeklyPlan, str]:
    """A semana pelo estado de agora + a comparacao com o objetivo. Nao mexe na agenda:
    os treinos ficam no proprio plano (kind=livre) ate o atleta usar algum dia."""
    context = build_context(db, user_id)
    _require_sufficient_data(context)
    start, end = week_range()
    days = ", ".join(
        f"{_WEEKDAYS_PT[d.weekday()]} {d.isoformat()}" for d in (start + timedelta(days=i) for i in range(7))
    )
    goal_week = db.execute(
        select(PlannedWorkout)
        .where(PlannedWorkout.user_id == user_id, PlannedWorkout.date >= start, PlannedWorkout.date <= end)
        .order_by(PlannedWorkout.date)
    ).scalars().all()
    base = _WEEK_PLAN_INSTRUCTION.format(days=days, context=json.dumps(context, ensure_ascii=False))
    user_content = _FREE_WEEK_INSTRUCTION.format(
        goal_week=json.dumps([_workout_brief(w) for w in goal_week], ensure_ascii=False), base=base,
    )
    parsed, model_used = call_llm(SYSTEM_PROMPT, user_content, response_model=FreeWeekLLM)
    workouts = validate_weekly_plan(parsed, start, end)

    db.execute(delete(WeeklyPlan).where(WeeklyPlan.user_id == user_id, WeeklyPlan.kind == "livre"))
    plan = WeeklyPlan(
        user_id=user_id,
        kind="livre",
        week_start=start,
        week_end=end,
        status=parsed.status,
        status_reason=parsed.status_justificativa,
        report={
            "resumo": parsed.resumo,
            "carga_semana_anterior": previous_week_load(context["analise"]),
            "avaliacao": {k: v[:3] for k, v in parsed.avaliacao.model_dump().items()},
            "proxima_semana": parsed.proxima_semana.model_dump(),
            "criterios_ajuste": {k: v[:3] for k, v in parsed.criterios_ajuste.model_dump().items()},
            "proximas_4_semanas": [w.model_dump() for w in parsed.proximas_4_semanas[:4]],
            "treinos": [w.model_dump() for w in workouts],
            "comparacao": parsed.comparacao.model_dump(),
        },
        model_used=model_used,
        prompt_version=settings.coach_prompt_version,
    )
    db.add(plan)
    db.commit()
    return plan, model_used


def use_free_week(db: Session, user_id: uuid.UUID, dates: list[date] | None = None) -> int:
    """Leva para a agenda os dias escolhidos do plano livre (None = a semana toda, de
    hoje em diante). Dia com treino no livre troca (ou cria) o da agenda; dia de
    descanso no livre apaga o planejado. Feito/pulado nao muda. Devolve quantos dias mudaram."""
    free = current_free_week(db, user_id)
    if free is None:
        raise PlanEditError("no_free_week", "Gere o plano da semana pelo estado de agora antes.", 404)
    today = date.today()
    by_date = {date.fromisoformat(w.data): w for w in free_week_workouts(free)}
    week_days = [free.week_start + timedelta(days=i) for i in range((free.week_end - free.week_start).days + 1)]
    chosen = [d for d in (dates or week_days) if d in week_days and d >= today]
    main = current_weekly_plan(db, user_id)
    goal = current_goal_plan(db, user_id)
    changed = 0
    for d in chosen:
        rows = db.execute(
            select(PlannedWorkout).where(PlannedWorkout.user_id == user_id, PlannedWorkout.date == d)
        ).scalars().all()
        if any(r.status != "planned" for r in rows):
            continue  # ja feito ou pulado
        fw = by_date.get(d)
        if fw is None:
            for r in rows:
                db.delete(r)
            changed += bool(rows)
            continue
        row = rows[0] if rows else PlannedWorkout(
            user_id=user_id, plan_batch_id=uuid.uuid4(),
            weekly_plan_id=main.id if main else None, goal_plan_id=goal.id if goal else None,
        )
        for name, value in _workout_fields(fw).items():
            setattr(row, name, value)
        row.targets = {**(row.targets or {}), "origem": "plano da semana"}
        row.updated_at = datetime.now(UTC)
        if not rows:
            db.add(row)
        for extra in rows[1:]:
            db.delete(extra)
        changed += 1
    db.commit()
    return changed
