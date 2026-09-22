import uuid
from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from ondilow_api.ai import coach_service
from ondilow_api.ai.athlete_analysis import build_analysis
from ondilow_api.ai.coach_service import (
    CoachPlanParseError,
    CoachUnavailableError,
    InsufficientDataError,
    generate_analysis,
    generate_plan,
)
from ondilow_api.deps import CurrentUser, DbSession
from ondilow_api.models.coach import CoachInteraction, PlannedWorkout
from ondilow_api.schemas.coach import (
    AnalyzeResponse,
    ChatHistoryItem,
    ChatRequest,
    ChatResponse,
    GeneratePlanRequest,
    PlannedWorkoutOut,
    UpdateWorkoutStatusRequest,
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
        reply, model_used = coach_service.chat(db, current_user.id, body.message)
    except CoachUnavailableError as e:
        _raise_unavailable(e)
    return {"reply": reply, "model_used": model_used}


@router.post("/analyze", response_model=AnalyzeResponse)
def post_analyze(current_user: CurrentUser, db: DbSession) -> dict:
    try:
        report, model_used = generate_analysis(db, current_user.id)
    except InsufficientDataError as e:
        _raise_insufficient_data(e)
    except CoachUnavailableError as e:
        _raise_unavailable(e)
    return {"report": report, "model_used": model_used, "generated_at": datetime.now(UTC)}


@router.post("/plan/generate", response_model=list[PlannedWorkoutOut])
def post_generate_plan(body: GeneratePlanRequest, current_user: CurrentUser, db: DbSession) -> list:
    try:
        rows, _model_used = generate_plan(db, current_user.id, days=body.days)
    except InsufficientDataError as e:
        _raise_insufficient_data(e)
    except CoachUnavailableError as e:
        _raise_unavailable(e)
    except CoachPlanParseError as e:
        _raise_parse_error(e)
    return rows


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
