import httpx
import pytest
from google import genai
from google.genai import errors

from kactus_api.ai import coach_service
from kactus_api.ai.coach_service import (
    CoachUnavailableError,
    _call_gemini,
    _gemini_error_reason,
    _same_sport_group,
)
from kactus_api.config import settings


def test_same_sport_group_groups_related_disciplines():
    assert _same_sport_group("run", "trail_run") is True
    assert _same_sport_group("bike", "mtb") is True
    assert _same_sport_group("swim", "open_water_swim") is True
    assert _same_sport_group("run", "bike") is False


def _gemini_error(cls, code: int, status: str, message: str = "x"):
    return cls(code, {"error": {"code": code, "status": status, "message": message}})


@pytest.mark.parametrize(
    ("cls", "code", "status", "message", "expected"),
    [
        (errors.ClientError, 429, "RESOURCE_EXHAUSTED", "Quota exceeded", "quota_exceeded"),
        (errors.ClientError, 400, "INVALID_ARGUMENT", "API key not valid. Please pass a valid API key.", "invalid_key"),
        (errors.ClientError, 403, "PERMISSION_DENIED", "denied", "invalid_key"),
        (errors.ClientError, 404, "NOT_FOUND", "models/x is not found", "model_not_found"),
        (errors.ServerError, 503, "UNAVAILABLE", "overloaded", "llm_unavailable"),
    ],
)
def test_gemini_error_reason_maps_sdk_errors(cls, code, status, message, expected):
    assert _gemini_error_reason(_gemini_error(cls, code, status, message)) == expected


class _FakeModels:
    def __init__(self, exc):
        self.exc = exc
        self.calls = 0

    def generate_content(self, **_kwargs):
        self.calls += 1
        raise self.exc


def test_call_gemini_turns_quota_error_into_unavailable_without_retry(monkeypatch):
    fake_models = _FakeModels(_gemini_error(errors.ClientError, 429, "RESOURCE_EXHAUSTED"))
    created = {}

    class _FakeClient:
        def __init__(self, **kwargs):
            created.update(kwargs)
            self.models = fake_models

    monkeypatch.setattr(genai, "Client", _FakeClient)
    monkeypatch.setattr(settings, "gemini_api_key", "fake-key")

    with pytest.raises(CoachUnavailableError) as exc_info:
        _call_gemini("sys", "oi", None)

    assert exc_info.value.reason == "quota_exceeded"
    assert fake_models.calls == 1
    assert created["http_options"].retry_options.attempts == 1


class _Resp:
    text = "resposta"


class _PerModel:
    """Falha com o erro mapeado para o modelo, ou responde se nao houver erro."""

    def __init__(self, errors_by_model):
        self.errors_by_model = errors_by_model
        self.tried = []

    def generate_content(self, *, model, **_kwargs):
        self.tried.append(model)
        if model in self.errors_by_model:
            raise self.errors_by_model[model]
        return _Resp()


def _patch_client(monkeypatch, models):
    class _FakeClient:
        def __init__(self, **_kwargs):
            self.models = models

    monkeypatch.setattr(genai, "Client", _FakeClient)
    monkeypatch.setattr(settings, "gemini_api_key", "fake-key")
    monkeypatch.setattr(settings, "gemini_model", "modelo-a, modelo-b")


def test_call_gemini_falls_back_to_next_model_on_overload(monkeypatch):
    models = _PerModel({"modelo-a": _gemini_error(errors.ServerError, 503, "UNAVAILABLE")})
    _patch_client(monkeypatch, models)

    text, model_used = _call_gemini("sys", "oi", None)

    assert (text, model_used) == ("resposta", "modelo-b")
    assert models.tried == ["modelo-a", "modelo-b"]


def test_call_gemini_does_not_fall_back_on_quota(monkeypatch):
    models = _PerModel({"modelo-a": _gemini_error(errors.ClientError, 429, "RESOURCE_EXHAUSTED")})
    _patch_client(monkeypatch, models)

    with pytest.raises(CoachUnavailableError) as exc_info:
        _call_gemini("sys", "oi", None)

    assert exc_info.value.reason == "quota_exceeded"
    assert models.tried == ["modelo-a"]


def test_call_gemini_falls_back_on_timeout_and_reports_it_when_all_time_out(monkeypatch):
    timeout = httpx.ReadTimeout("demorou")
    models = _PerModel({"modelo-a": timeout, "modelo-b": timeout})
    _patch_client(monkeypatch, models)

    with pytest.raises(CoachUnavailableError) as exc_info:
        _call_gemini("sys", "oi", None)

    assert exc_info.value.reason == "llm_timeout"
    assert models.tried == ["modelo-a", "modelo-b"]


def test_call_gemini_skips_next_model_when_budget_is_spent(monkeypatch):
    models = _PerModel({"modelo-a": _gemini_error(errors.ServerError, 503, "UNAVAILABLE")})
    _patch_client(monkeypatch, models)
    clock = iter([0.0, 0.0, 190.0])  # deadline, 1a tentativa, 2a tentativa (so sobram 10s)
    monkeypatch.setattr(coach_service.time, "monotonic", lambda: next(clock))

    with pytest.raises(CoachUnavailableError) as exc_info:
        _call_gemini("sys", "oi", None)

    assert exc_info.value.reason == "llm_unavailable"
    assert models.tried == ["modelo-a"]


def test_call_gemini_unavailable_when_every_model_is_overloaded(monkeypatch):
    overloaded = _gemini_error(errors.ServerError, 503, "UNAVAILABLE")
    models = _PerModel({"modelo-a": overloaded, "modelo-b": overloaded})
    _patch_client(monkeypatch, models)

    with pytest.raises(CoachUnavailableError) as exc_info:
        _call_gemini("sys", "oi", None)

    assert exc_info.value.reason == "llm_unavailable"
