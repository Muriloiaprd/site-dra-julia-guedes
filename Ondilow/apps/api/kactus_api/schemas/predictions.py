from pydantic import BaseModel, Field


class RacePrediction(BaseModel):
    distance: str
    distance_m: int
    predicted_s: int
    confidence: float
    source: str
    vdot: float


class RiskAssessment(BaseModel):
    level: str
    reasons: list[str]
    recommendation: str


class SimulatedDay(BaseModel):
    date: str
    ctl: float
    atl: float
    tsb: float
    planned_tss: float


class SimulateRequest(BaseModel):
    planned_tss: list[float] = Field(..., max_length=90)
    current_ctl: float | None = None
    current_atl: float | None = None


class TrainingRecommendation(BaseModel):
    type: str
    label: str
    color: str
    detail: str | None = None


class PredictionsOverview(BaseModel):
    race_predictions: list[RacePrediction]
    risk: RiskAssessment
    recommendation: TrainingRecommendation
