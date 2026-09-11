"""Normalizacao de nomes de esporte para os valores do enum `sport` do banco.

Cada formato/dispositivo usa nomenclatura propria (FIT: 'running', Strava/TCX:
'Running', Garmin: 'lap_swimming'). Aqui tudo colapsa nos valores canonicos.
"""

VALID_SPORTS = {
    "run",
    "trail_run",
    "treadmill",
    "bike",
    "mtb",
    "gravel",
    "indoor_bike",
    "swim",
    "open_water_swim",
    "multisport",
    "other",
}

_ALIASES = {
    "running": "run",
    "run": "run",
    "trail": "trail_run",
    "trail_running": "trail_run",
    "treadmill": "treadmill",
    "treadmill_running": "treadmill",
    "indoor_running": "treadmill",
    "cycling": "bike",
    "biking": "bike",
    "bike": "bike",
    "road_biking": "bike",
    "road_cycling": "bike",
    "mountain_biking": "mtb",
    "mtb": "mtb",
    "gravel_cycling": "gravel",
    "gravel": "gravel",
    "indoor_cycling": "indoor_bike",
    "virtual_ride": "indoor_bike",
    "indoor_bike": "indoor_bike",
    "swimming": "swim",
    "lap_swimming": "swim",
    "pool_swimming": "swim",
    "swim": "swim",
    "open_water": "open_water_swim",
    "open_water_swimming": "open_water_swim",
    "openwaterswimming": "open_water_swim",
    "multisport": "multisport",
    "triathlon": "multisport",
    # nomenclatura da API do Strava (sport_type)
    "run": "run",
    "trailrun": "trail_run",
    "treadmillrun": "treadmill",
    "ride": "bike",
    "mountainbikeride": "mtb",
    "gravelride": "gravel",
    "ebikeride": "bike",
    "virtualride": "indoor_bike",
    "swim": "swim",
    "openwaterswim": "open_water_swim",
}


def normalize_sport(raw: str | None, sub_sport: str | None = None) -> str:
    for candidate in (sub_sport, raw):
        if not candidate:
            continue
        key = str(candidate).strip().lower().replace(" ", "_").replace("-", "_")
        if key in _ALIASES:
            return _ALIASES[key]
        if key in VALID_SPORTS:
            return key
    return "other"
