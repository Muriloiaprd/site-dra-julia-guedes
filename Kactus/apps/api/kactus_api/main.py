import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from kactus_api.config import settings
from kactus_api.logger import get_logger
from kactus_api.logging_setup import configure_logging
from kactus_api.rate_limit import limiter
from kactus_api.routers import (
    activities,
    auth,
    coach,
    equipment,
    metrics,
    predictions,
    profile,
    push,
)

log = get_logger(__name__)


PUSH_CHECK_S = 10 * 60


def _push_daily_check() -> None:
    from kactus_api.db import SessionLocal
    from kactus_api.services.push import daily_check

    db = SessionLocal()
    try:
        daily_check(db)
    finally:
        db.close()


async def _push_loop() -> None:
    """Avisos do dia (treino de hoje, dias sem treinar): confere a cada 10 min enquanto a API roda."""
    while True:
        try:
            await asyncio.to_thread(_push_daily_check)
        except Exception:
            log.exception("push_daily_check_failed")
        await asyncio.sleep(PUSH_CHECK_S)


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    task = asyncio.create_task(_push_loop()) if settings.push_scheduler else None
    yield
    if task:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


app = FastAPI(title="Kactus API", version="0.1.0", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(activities.router)
app.include_router(profile.router)
app.include_router(metrics.router)
app.include_router(predictions.router)
app.include_router(equipment.router)
app.include_router(coach.router)
app.include_router(push.router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    log.exception("unhandled_exception", path=request.url.path, method=request.method)
    return JSONResponse(
        status_code=500,
        content={"detail": {"error": "internal_error", "message": "Erro interno. Tente novamente."}},
    )


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "env": settings.app_env}
