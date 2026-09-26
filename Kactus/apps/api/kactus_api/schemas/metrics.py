from datetime import date

from pydantic import BaseModel, ConfigDict


class DailyMetricOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    date: date
    daily_load: float | None = None
    ctl: float | None = None
    atl: float | None = None
    tsb: float | None = None
    acwr: float | None = None
