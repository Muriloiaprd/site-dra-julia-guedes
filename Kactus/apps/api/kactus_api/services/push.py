"""Notificações Web Push (iPhone com o app na Tela de Início, iOS 16.4+, e navegadores).

Três avisos, cada um ligado e desligado no Perfil:
- treino_hoje: de manhã (a partir das 7h), o treino planejado do dia;
- recorde: quando um treino recente importado bate recorde pessoal;
- sem_treino: no fim da tarde (a partir das 18h), depois de 3 dias sem treinar.

O envio sai do próprio PC (a API só roda com o PC ligado) direto para o serviço de
push do aparelho (Apple, Google, Mozilla), assinado com as chaves VAPID geradas aqui
na primeira vez e guardadas em data/push/vapid.pem. `push_log` guarda o que já foi
avisado, para cada aviso sair uma vez só.
"""

from __future__ import annotations

import base64
import json
import threading
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from py_vapid import Vapid02
from pywebpush import WebPushException, webpush
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from kactus_api.config import settings
from kactus_api.logger import get_logger
from kactus_api.models import Activity, AthleteProfile, PlannedWorkout, PushLog, PushSubscription

log = get_logger(__name__)

DEFAULT_PREFS = {"treino_hoje": True, "recorde": True, "sem_treino": True}
HORA_TREINO = 7
HORA_SEM_TREINO = 18
SEM_TREINO_DIAS = 3
RECORDE_RECENTE = timedelta(days=2)  # importar treino antigo não vira "recorde novo"
MAX_FAILURES = 5
# o "sub" do VAPID precisa ser mailto: ou https:; a Apple recusa endereço inválido
VAPID_SUB = "mailto:kactus@example.com"

RECORD_LABELS = {
    "fastest_1k": "1 km", "fastest_5k": "5 km", "fastest_10k": "10 km", "fastest_21k": "meia maratona",
    "fastest_42k": "maratona", "longest_run": "corrida mais longa", "longest_ride": "pedal mais longo",
    "longest_swim": "nado mais longo", "most_elevation_gain": "maior subida", "fastest_100m_swim": "100 m nado",
    "fastest_400m_swim": "400 m nado", "max_hr_recorded": "FC máxima", "max_power_1s": "potência máxima",
    "best_power_5min": "potência de 5 min", "best_power_20min": "potência de 20 min", "best_power_60min": "potência de 60 min",
}

_vapid_lock = threading.Lock()
_vapid: Vapid02 | None = None


@dataclass(frozen=True)
class Message:
    title: str
    body: str
    url: str = "/dashboard"


def vapid() -> Vapid02:
    """Chaves VAPID do Kactus: geradas na primeira vez e guardadas no disco."""
    global _vapid
    with _vapid_lock:
        if _vapid is None:
            path = settings.data_path / "push" / "vapid.pem"
            if path.exists():
                _vapid = Vapid02.from_file(str(path))
            else:
                path.parent.mkdir(parents=True, exist_ok=True)
                v = Vapid02()
                v.generate_keys()
                v.save_key(str(path))
                _vapid = v
        return _vapid


def public_key() -> str:
    """Chave pública no formato do `applicationServerKey` (ponto não comprimido, base64url)."""
    raw = vapid().public_key.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def user_prefs(db: Session, user_id: uuid.UUID) -> dict:
    profile = db.get(AthleteProfile, user_id)
    return {**DEFAULT_PREFS, **((profile.push_prefs if profile else None) or {})}


def _deliver(sub: PushSubscription, payload: str) -> str:
    """Manda para um aparelho. 'ok', 'gone' (inscrição morta) ou 'error'."""
    try:
        webpush(
            subscription_info={"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}},
            data=payload,
            vapid_private_key=vapid(),
            vapid_claims={"sub": VAPID_SUB},
            ttl=12 * 3600,
            timeout=15,
        )
        return "ok"
    except WebPushException as e:
        code = e.response.status_code if e.response is not None else None
        log.warning("push_failed", status=code, endpoint=sub.endpoint[:60])
        return "gone" if code in (404, 410) else "error"
    except Exception:  # rede fora, timeout: tenta de novo no próximo aviso
        log.exception("push_error", endpoint=sub.endpoint[:60])
        return "error"


def send_now(db: Session, user_id: uuid.UUID, msg: Message) -> int:
    """Manda para todos os aparelhos do usuário, sem conferir o histórico. Devolve quantos receberam."""
    subs = db.execute(select(PushSubscription).where(PushSubscription.user_id == user_id)).scalars().all()
    payload = json.dumps({"title": msg.title, "body": msg.body, "url": msg.url}, ensure_ascii=False)
    ok = 0
    for sub in subs:
        result = _deliver(sub, payload)
        if result == "ok":
            ok += 1
            sub.failures = 0
            sub.last_sent_at = func.now()
        elif result == "gone":
            db.delete(sub)
        else:
            sub.failures += 1
            if sub.failures >= MAX_FAILURES:
                db.delete(sub)
    db.commit()
    return ok


def send_once(db: Session, user_id: uuid.UUID, msg: Message, *, kind: str, key: str) -> bool:
    """Manda se esse (tipo, chave) ainda não foi avisado e o tipo está ligado."""
    if not user_prefs(db, user_id).get(kind, False):
        return False
    has_subs = db.execute(select(func.count()).select_from(PushSubscription).where(PushSubscription.user_id == user_id)).scalar_one()
    if not has_subs:
        return False
    inserted = db.execute(
        insert(PushLog).values(id=uuid.uuid4(), user_id=user_id, kind=kind, key=key)
        .on_conflict_do_nothing(constraint="uq_push_log_user_kind_key")
        .returning(PushLog.id)
    ).first()
    db.commit()
    if inserted is None:
        return False
    send_now(db, user_id, msg)
    return True


def notify_records(db: Session, activity: Activity, broken: list[str]) -> bool:
    """Recorde novo num treino recente: aviso com o que foi batido."""
    if not broken or datetime.now(activity.start_time.tzinfo) - activity.start_time > RECORDE_RECENTE:
        return False
    nomes = [RECORD_LABELS.get(b, b) for b in broken]
    lista = nomes[0] if len(nomes) == 1 else ", ".join(nomes[:-1]) + " e " + nomes[-1]
    titulo = activity.title or "seu treino"
    msg = Message(
        title="🏆 Recorde novo!",
        body=f"{lista[0].upper() + lista[1:]} — {titulo}.",
        url=f"/activities/{activity.id}",
    )
    return send_once(db, activity.user_id, msg, kind="recorde", key=str(activity.id))


def notify_records_background(activity_id: uuid.UUID, broken: list[str]) -> None:
    """Na importação: o envio (rede) não segura a resposta."""
    if not broken:
        return

    def run() -> None:
        from kactus_api.db import SessionLocal

        db = SessionLocal()
        try:
            act = db.get(Activity, activity_id)
            if act is not None:
                notify_records(db, act, broken)
        except Exception:
            log.exception("push_records_failed")
        finally:
            db.close()

    threading.Thread(target=run, name="kactus-push-recorde", daemon=True).start()


def _fmt_km(m: float) -> str:
    return f"{m / 1000:.1f}".replace(".", ",").replace(",0", "") + " km"


def daily_check(db: Session, now: datetime | None = None) -> list[tuple[uuid.UUID, str]]:
    """Avisos do dia para quem tem aparelho inscrito. Devolve (usuário, tipo) enviados."""
    now = now or datetime.now()
    today = now.date()
    sent: list[tuple[uuid.UUID, str]] = []
    users = db.execute(select(PushSubscription.user_id).distinct()).scalars().all()
    for user_id in users:
        if now.hour >= HORA_TREINO:
            w = db.execute(
                select(PlannedWorkout).where(
                    PlannedWorkout.user_id == user_id,
                    PlannedWorkout.date == today,
                    PlannedWorkout.status == "planned",
                ).order_by(PlannedWorkout.created_at.desc())
            ).scalars().first()
            if w is not None:
                partes = [w.title]
                if w.target_distance_m:
                    partes.append(_fmt_km(float(w.target_distance_m)))
                elif w.target_duration_s:
                    partes.append(f"{round(w.target_duration_s / 60)} min")
                msg = Message(title="Treino de hoje", body=" · ".join(partes), url="/dashboard")
                if send_once(db, user_id, msg, kind="treino_hoje", key=today.isoformat()):
                    sent.append((user_id, "treino_hoje"))
        if now.hour >= HORA_SEM_TREINO:
            last = db.execute(
                select(func.max(Activity.start_time)).where(Activity.user_id == user_id, Activity.deleted_at.is_(None))
            ).scalar_one()
            if last is not None:
                last_day: date = last.astimezone().date() if last.tzinfo else last.date()
                dias = (today - last_day).days
                if dias >= SEM_TREINO_DIAS:
                    msg = Message(
                        title=f"{dias} dias sem treinar",
                        body="Que tal um treino leve amanhã? A Duni monta com você.",
                        url="/coach",
                    )
                    # uma vez por sequência: a chave é o dia do último treino
                    if send_once(db, user_id, msg, kind="sem_treino", key=last_day.isoformat()):
                        sent.append((user_id, "sem_treino"))
    return sent
