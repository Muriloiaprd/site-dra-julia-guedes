import uuid
from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from ondilow_api.ai import coach_service
from ondilow_api.ai.athlete_analysis import build_analysis
from ondilow_api.ai.coach_service import (
    ActivityNotFoundError,
    CoachPlanParseError,
    CoachUnavailableError,
    InsufficientDataError,
    PlanConflictError,
    PlanEditError,
    generate_analysis,
    generate_weekly_plan,
)
from ondilow_api.deps import CurrentUser, DbSession
from ondilow_api.models.coach import AthleteMemory, CoachInteraction, PlannedWorkout
from ondilow_api.schemas.coach import (
    ActivityCommentResponse,
    AnalyzeResponse,
    ChatHistoryItem,
    ChatRequest,
    ChatResponse,
    MemoryIn,
    MemoryOut,
    MemoryUpdate,
    MoveWorkoutRequest,
    PlannedWorkoutOut,
    RegenerateWorkoutRequest,
    RegenerateWorkoutResponse,
    UpdateWorkoutStatusRequest,
    WeeklyPlanResponse,
)

router = APIRouter(prefix="/coach", tags=["coach"])


def _raise_unavailable(e: CoachUnavailableError) -> None:
    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail={"error": e.reason}) from e


def _raise_insufficient_data(e: InsufficientDataError) -> None:
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail={"error": "insufficient_data", "weeks_available": e.weeks_available},
    ) from e


def _raise_parse_error(e: CoachPlanParseError) -> None:
    raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail={"error": "invalid_plan_response", "message": str(e)}) from e


@router.post("/chat", response_model=ChatResponse)
def post_chat(body: ChatRequest, current_user: CurrentUser, db: DbSession) -> dict:
    try:
        reply, model_used, suggestions = coach_service.chat(db, current_user.id, body.message)
    except CoachUnavailableError as e:
        _raise_unavailable(e)
    except CoachPlanParseError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail={"error": "invalid_response", "message": str(e)}
        ) from e
    return {"reply": reply, "model_used": model_used, "memory_suggestions": suggestions}


# ── memorias ────────────────────────────────────────────────────────────────


def _load_memory(db: DbSession, memory_id: uuid.UUID, user_id: uuid.UUID) -> AthleteMemory:
    memory = db.execute(
        select(AthleteMemory).where(AthleteMemory.id == memory_id, AthleteMemory.user_id == user_id)
    ).scalar_one_or_none()
    if memory is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memoria nao encontrada")
    return memory


@router.get("/memories", response_model=list[MemoryOut])
def list_memories(current_user: CurrentUser, db: DbSession, include_archived: bool = False) -> list:
    stmt = select(AthleteMemory).where(AthleteMemory.user_id == current_user.id)
    if not include_archived:
        stmt = stmt.where(AthleteMemory.active.is_(True))
    return list(db.execute(stmt.order_by(AthleteMemory.created_at.asc())).scalars())


@router.post("/memories", response_model=MemoryOut, status_code=status.HTTP_201_CREATED)
def create_memory(body: MemoryIn, current_user: CurrentUser, db: DbSession) -> AthleteMemory:
    memory = AthleteMemory(
        user_id=current_user.id,
        kind=body.kind,
        content=body.content.strip(),
        event_date=body.event_date,
        source=body.source,
    )
    db.add(memory)
    db.commit()
    db.refresh(memory)
    return memory


@router.patch("/memories/{memory_id}", response_model=MemoryOut)
def update_memory(memory_id: uuid.UUID, body: MemoryUpdate, current_user: CurrentUser, db: DbSession) -> AthleteMemory:
    memory = _load_memory(db, memory_id, current_user.id)
    for field, value in body.model_dump(exclude_unset=True).items():
        if field in ("kind", "content", "active") and value is None:
            continue  # campo obrigatorio: null nao apaga
        setattr(memory, field, value.strip() if field == "content" else value)
    memory.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(memory)
    return memory


@router.delete("/memories/{memory_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_memory(memory_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> None:
    db.delete(_load_memory(db, memory_id, current_user.id))
    db.commit()


@router.post("/analyze", response_model=AnalyzeResponse)
def post_analyze(current_user: CurrentUser, db: DbSession) -> dict:
    try:
        report, model_used = generate_analysis(db, current_user.id)
    except InsufficientDataError as e:
        _raise_insufficient_data(e)
    except CoachUnavailableError as e:
        _raise_unavailable(e)
    return {"report": report, "model_used": model_used, "generated_at": datetime.now(UTC)}


@router.post("/plan/generate", response_model=WeeklyPlanResponse)
def post_generate_plan(current_user: CurrentUser, db: DbSession) -> dict:
    """Plano da proxima semana (7 dias a partir de amanha), com status e relatorio."""
    try:
        plan, rows, _model_used = generate_weekly_plan(db, current_user.id)
    except InsufficientDataError as e:
        _raise_insufficient_data(e)
    except CoachUnavailableError as e:
        _raise_unavailable(e)
    except CoachPlanParseError as e:
        _raise_parse_error(e)
    return {"plan": plan, "workouts": rows}


@router.get("/plan/week", response_model=WeeklyPlanResponse)
def get_plan_week(current_user: CurrentUser, db: DbSession) -> dict:
    """O plano semanal que ainda nao terminou (ou nada) e os treinos dele."""
    coach_service.reconcile_plan(db, current_user.id)
    plan = coach_service.current_weekly_plan(db, current_user.id)
    if plan is None:
        return {"plan": None, "workouts": []}
    rows = db.execute(
        select(PlannedWorkout)
        .where(PlannedWorkout.user_id == current_user.id, PlannedWorkout.weekly_plan_id == plan.id)
        .order_by(PlannedWorkout.date.asc())
    ).scalars().all()
    return {"plan": plan, "workouts": list(rows)}


def _raise_plan_edit(e: PlanEditError) -> None:
    raise HTTPException(status_code=e.status_code, detail={"error": e.code, "message": str(e)}) from e


@router.post("/plan/{workout_id}/regenerate", response_model=RegenerateWorkoutResponse)
def post_regenerate_workout(
    workout_id: uuid.UUID, body: RegenerateWorkoutRequest, current_user: CurrentUser, db: DbSession
) -> dict:
    try:
        workout, explanation, model_used = coach_service.regenerate_workout(db, current_user.id, workout_id, body.reason)
    except PlanEditError as e:
        _raise_plan_edit(e)
    except CoachUnavailableError as e:
        _raise_unavailable(e)
    except CoachPlanParseError as e:
        _raise_parse_error(e)
    return {"workout": workout, "explanation": explanation, "model_used": model_used}


@router.post("/plan/{workout_id}/move", response_model=PlannedWorkoutOut)
def post_move_workout(workout_id: uuid.UUID, body: MoveWorkoutRequest, current_user: CurrentUser, db: DbSession) -> PlannedWorkout:
    try:
        return coach_service.move_workout(db, current_user.id, workout_id, body.date, body.on_conflict)
    except PlanEditError as e:
        _raise_plan_edit(e)
    except PlanConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "date_conflict",
                "message": f"Já tem \"{e.conflict.title}\" nesse dia.",
                "conflict": {"id": str(e.conflict.id), "title": e.conflict.title, "status": e.conflict.status},
            },
        ) from e


@router.get("/plan", response_model=list[PlannedWorkoutOut])
def get_plan(current_user: CurrentUser, db: DbSession, days_ahead: int = Query(default=14, ge=1, le=90)) -> list:
    coach_service.reconcile_plan(db, current_user.id)
    today = date.today()
    horizon = today + timedelta(days=days_ahead)
    rows = db.execute(
        select(PlannedWorkout)
        .where(
            PlannedWorkout.user_id == current_user.id,
            PlannedWorkout.date >= today,
            PlannedWorkout.date <= horizon,
        )
        .order_by(PlannedWorkout.date.asc())
    ).scalars().all()
    return list(rows)


@router.patch("/plan/{workout_id}", response_model=PlannedWorkoutOut)
def patch_workout(
    workout_id: uuid.UUID,
    body: UpdateWorkoutStatusRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> PlannedWorkout:
    workout = db.execute(
        select(PlannedWorkout).where(
            PlannedWorkout.id == workout_id, PlannedWorkout.user_id == current_user.id
        )
    ).scalar_one_or_none()
    if not workout:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Treino nao encontrado")
    if body.status is not None:
        if body.status not in {"planned", "done", "skipped"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Status invalido")
        workout.status = body.status
    if body.activity_id is not None:
        workout.activity_id = body.activity_id
    db.commit()
    return workout


def _comment_out(row: CoachInteraction | None) -> dict:
    if row is None:
        return {"comment": None}
    return {"comment": row.content, "model_used": row.model_used, "generated_at": row.created_at}


@router.get("/activities/{activity_id}/analyze", response_model=ActivityCommentResponse)
def get_activity_comment(activity_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> dict:
    """Ultimo comentario salvo (nao chama a IA)."""
    try:
        return _comment_out(coach_service.latest_activity_comment(db, current_user.id, activity_id))
    except ActivityNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Atividade nao encontrada") from e


@router.post("/activities/{activity_id}/analyze", response_model=ActivityCommentResponse)
def post_activity_comment(activity_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> dict:
    """Pede um comentario novo a Duni (gasta cota; so sob demanda)."""
    try:
        return _comment_out(coach_service.generate_activity_comment(db, current_user.id, activity_id))
    except ActivityNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Atividade nao encontrada") from e
    except CoachUnavailableError as e:
        _raise_unavailable(e)


@router.get("/analysis")
def get_analysis(current_user: CurrentUser, db: DbSession) -> dict:
    """Fatos calculados (sem IA) que a Duni interpreta: janelas 7/14/28d,
    tendencia semanal, sinais de fadiga, sessoes equivalentes, lacunas."""
    return build_analysis(db, current_user.id)


@router.get("/chat/history", response_model=list[ChatHistoryItem])
def get_chat_history(current_user: CurrentUser, db: DbSession, limit: int = Query(default=50, ge=1, le=200)) -> list:
    rows = db.execute(
        select(CoachInteraction)
        .where(CoachInteraction.user_id == current_user.id, CoachInteraction.kind == "chat")
        .order_by(CoachInteraction.created_at.desc())
        .limit(limit)
    ).scalars().all()
    return list(reversed(rows))
