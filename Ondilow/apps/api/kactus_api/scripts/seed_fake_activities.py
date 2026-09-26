"""Insere atividades ficticias realistas para o usuario teste@teste.com.

Rodar: uv run python -m kactus_api.scripts.seed_fake_activities
"""

import random
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from kactus_api.db import SessionLocal
from kactus_api.models.activity import Activity
from kactus_api.models.user import User

TEST_EMAIL = "teste@teste.com"

random.seed(42)

def rand(lo, hi, decimals=1):
    return round(random.uniform(lo, hi), decimals)

def make_run(user_id, start_time, distance_km, pace_s_per_km=None):
    distance_m = distance_km * 1000
    pace = pace_s_per_km or rand(270, 360)  # 4:30 a 6:00/km
    duration_s = int(distance_m / 1000 * pace)
    avg_hr = int(rand(145, 172))
    return Activity(
        id=uuid.uuid4(),
        user_id=user_id,
        sport="run",
        start_time=start_time,
        duration_s=duration_s,
        moving_time_s=int(duration_s * rand(0.92, 0.98)),
        distance_m=distance_m,
        avg_pace_s_per_km=pace,
        avg_hr=avg_hr,
        max_hr=avg_hr + int(rand(8, 20)),
        avg_cadence=rand(170, 182),
        calories=int(distance_km * rand(62, 72)),
        elevation_gain_m=rand(10, 80),
        source="manual",
        title=_run_title(distance_km),
    )

def make_bike(user_id, start_time, distance_km):
    distance_m = distance_km * 1000
    speed_kmh = rand(24, 34)
    duration_s = int((distance_km / speed_kmh) * 3600)
    avg_hr = int(rand(140, 165))
    return Activity(
        id=uuid.uuid4(),
        user_id=user_id,
        sport="bike",
        start_time=start_time,
        duration_s=duration_s,
        moving_time_s=int(duration_s * rand(0.93, 0.99)),
        distance_m=distance_m,
        avg_speed_kmh=speed_kmh,
        max_speed_kmh=rand(speed_kmh + 5, speed_kmh + 18),
        avg_hr=avg_hr,
        max_hr=avg_hr + int(rand(10, 22)),
        avg_power_w=int(rand(170, 240)),
        normalized_power_w=int(rand(180, 260)),
        avg_cadence=rand(82, 95),
        calories=int(distance_km * rand(30, 40)),
        elevation_gain_m=rand(50, 400),
        source="manual",
        title=f"Ciclismo {distance_km:.0f}km",
    )

def make_swim(user_id, start_time, distance_m_swim):
    pace_s_per_100m = rand(95, 130)
    duration_s = int(distance_m_swim / 100 * pace_s_per_100m)
    avg_hr = int(rand(140, 162))
    return Activity(
        id=uuid.uuid4(),
        user_id=user_id,
        sport="swim",
        start_time=start_time,
        duration_s=duration_s,
        moving_time_s=duration_s,
        distance_m=distance_m_swim,
        avg_hr=avg_hr,
        max_hr=avg_hr + int(rand(8, 16)),
        avg_cadence=rand(28, 38),
        calories=int(distance_m_swim / 1000 * rand(280, 340)),
        source="manual",
        title=f"Natação {distance_m_swim:.0f}m",
    )

def _run_title(km):
    if km < 6:
        return f"Corrida curta {km:.1f}km"
    if km < 12:
        return f"Corrida {km:.1f}km"
    if km < 20:
        return f"Long run {km:.1f}km"
    return f"Corridão {km:.1f}km"

def main():
    with SessionLocal() as db:
        user = db.execute(select(User).where(User.email == TEST_EMAIL)).scalar_one_or_none()
        if not user:
            raise SystemExit(f"Usuário {TEST_EMAIL} não encontrado. Rode seed_user primeiro.")

        # Apaga atividades existentes do teste para não duplicar
        existing = db.execute(select(Activity).where(Activity.user_id == user.id)).scalars().all()
        for a in existing:
            db.delete(a)
        db.flush()

        now = datetime.now(timezone.utc)
        activities = []

        # 90 dias de treinos (3 semanas fácil, 3 moderado, 3 intenso, 1 recuperação)
        for week in range(13):
            monday = now - timedelta(days=now.weekday()) - timedelta(weeks=12 - week)
            intensity = "easy" if week < 3 else "hard" if 3 <= week < 10 else "recovery"

            # Segunda - corrida
            if random.random() > 0.15:
                km = rand(6, 10) if intensity == "easy" else rand(8, 14) if intensity == "hard" else rand(4, 6)
                pace = rand(310, 350) if intensity == "easy" else rand(275, 310) if intensity == "hard" else rand(320, 360)
                activities.append(make_run(user.id, monday.replace(hour=6, minute=30), km, pace))

            # Terça - bike ou descanso
            if random.random() > 0.3:
                km = rand(30, 50) if intensity == "easy" else rand(50, 80) if intensity == "hard" else rand(20, 35)
                activities.append(make_bike(user.id, (monday + timedelta(days=1)).replace(hour=7), km))

            # Quarta - corrida qualidade
            if random.random() > 0.2:
                km = rand(8, 12) if intensity == "easy" else rand(10, 16) if intensity == "hard" else rand(5, 8)
                pace = rand(280, 320) if intensity == "hard" else rand(300, 340)
                activities.append(make_run(user.id, (monday + timedelta(days=2)).replace(hour=6, minute=15), km, pace))

            # Quinta - natação
            if random.random() > 0.35:
                dist = rand(1500, 2500) if intensity == "easy" else rand(2500, 3500) if intensity == "hard" else rand(1000, 1800)
                activities.append(make_swim(user.id, (monday + timedelta(days=3)).replace(hour=7, minute=30), dist))

            # Sexta - corrida leve ou descanso
            if random.random() > 0.4:
                km = rand(5, 8) if intensity == "easy" else rand(6, 10) if intensity == "hard" else rand(4, 6)
                activities.append(make_run(user.id, (monday + timedelta(days=4)).replace(hour=6), km, rand(320, 360)))

            # Sábado - long run
            if random.random() > 0.1:
                km = rand(12, 18) if intensity == "easy" else rand(18, 28) if intensity == "hard" else rand(8, 12)
                pace = rand(290, 330) if intensity == "hard" else rand(310, 350)
                activities.append(make_run(user.id, (monday + timedelta(days=5)).replace(hour=7), km, pace))

            # Domingo - bike longo ou descanso
            if random.random() > 0.45:
                km = rand(40, 70) if intensity == "easy" else rand(70, 120) if intensity == "hard" else rand(20, 40)
                activities.append(make_bike(user.id, (monday + timedelta(days=6)).replace(hour=8), km))

        for a in activities:
            db.add(a)
        db.commit()
        print(f"✓ {len(activities)} atividades inseridas para {TEST_EMAIL}")

if __name__ == "__main__":
    main()
