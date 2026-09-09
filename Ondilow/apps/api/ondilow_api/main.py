from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ondilow_api.config import settings
from ondilow_api.logging_setup import configure_logging
from ondilow_api.routers import activities, auth, exports, integrations, metrics, predictions, profile


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    for sub in ("uploads", "exports", "logs"):
        (settings.data_path / sub).mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title="Ondilow API", version="0.1.0", lifespan=lifespan)

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
app.include_router(integrations.router)
app.include_router(exports.router)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "env": settings.app_env}
