"""Sincronizacao com Garmin Connect via garminconnect (biblioteca nao-oficial).

Fluxo:
1. Descriptografa credenciais (Fernet) armazenadas em user_integrations
2. Login no Garmin Connect
3. Lista atividades recentes
4. Para cada atividade nova: baixa FIT (zip), extrai, chama import_activity()
5. Atualiza user_integrations com status e timestamp do ultimo sync
"""

import io
import json
import zipfile
from dataclasses import dataclass, field
from datetime import datetime, timezone

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy.orm import Session

from ondilow_api.config import settings
from ondilow_api.models.user import UserIntegration
from ondilow_api.parsers.dispatch import parse_file
from ondilow_api.services.import_service import ImportResult, file_sha256, import_activity

PROVIDER = "garmin"
DEFAULT_LIMIT = 25  # atividades por sync


@dataclass
class SyncResult:
    imported: int = 0
    skipped: int = 0
    errors: list[str] = field(default_factory=list)


def encrypt_credentials(email: str, password: str) -> bytes:
    if not settings.fernet_key:
        raise RuntimeError("FERNET_KEY nao configurado no .env")
    f = Fernet(settings.fernet_key.encode())
    payload = json.dumps({"email": email, "password": password})
    return f.encrypt(payload.encode())


def decrypt_credentials(encrypted: bytes) -> tuple[str, str]:
    if not settings.fernet_key:
        raise RuntimeError("FERNET_KEY nao configurado no .env")
    try:
        f = Fernet(settings.fernet_key.encode())
        payload = json.loads(f.decrypt(encrypted).decode())
        return payload["email"], payload["password"]
    except (InvalidToken, KeyError, json.JSONDecodeError) as e:
        raise ValueError("Credenciais invalidas ou chave de criptografia incorreta") from e


def sync_garmin(db: Session, user_id, integration: UserIntegration, limit: int = DEFAULT_LIMIT) -> SyncResult:
    """Executa sync do Garmin Connect para um usuario."""
    from garminconnect import Garmin, GarminConnectAuthenticationError, GarminConnectConnectionError

    result = SyncResult()

    try:
        email, password = decrypt_credentials(integration.credentials_encrypted)
    except ValueError as e:
        _update_integration(db, integration, "error", str(e))
        result.errors.append(str(e))
        return result

    try:
        client = Garmin(email=email, password=password)
        client.login()
    except GarminConnectAuthenticationError as e:
        msg = "Credenciais do Garmin invalidas. Recadastre em Perfil > Garmin."
        _update_integration(db, integration, "error", msg)
        result.errors.append(msg)
        return result
    except GarminConnectConnectionError as e:
        msg = f"Erro de conexao com Garmin Connect: {e}"
        _update_integration(db, integration, "error", msg)
        result.errors.append(msg)
        return result
    except Exception as e:
        msg = f"Erro ao conectar ao Garmin: {type(e).__name__}: {e}"
        _update_integration(db, integration, "error", msg)
        result.errors.append(msg)
        return result

    try:
        activities = client.get_activities(0, limit)
    except Exception as e:
        msg = f"Erro ao listar atividades: {e}"
        _update_integration(db, integration, "error", msg)
        result.errors.append(msg)
        return result

    for act in activities:
        activity_id = str(act.get("activityId", ""))
        if not activity_id:
            continue

        try:
            zip_data = client.download_activity(
                activity_id,
                dl_fmt=client.ActivityDownloadFormat.ORIGINAL,
            )
            fit_bytes = _extract_fit_from_zip(zip_data)
            if fit_bytes is None:
                result.skipped += 1
                continue

            sha = file_sha256(fit_bytes)
            norm_list = parse_file(f"{activity_id}.fit", fit_bytes)
            for norm in norm_list:
                norm.source = "garmin_api"
                norm.source_activity_id = activity_id
                imp: ImportResult = import_activity(db, user_id, norm, file_hash=sha)
                if imp.duplicate:
                    result.skipped += 1
                else:
                    result.imported += 1

        except Exception as e:
            result.errors.append(f"Atividade {activity_id}: {type(e).__name__}: {e}")

    status = "error" if result.errors and result.imported == 0 else "success"
    _update_integration(db, integration, status, "; ".join(result.errors) if result.errors else None)
    return result


def _extract_fit_from_zip(zip_data: bytes) -> bytes | None:
    """Extrai o primeiro arquivo .fit de um zip do Garmin."""
    try:
        with zipfile.ZipFile(io.BytesIO(zip_data)) as zf:
            for name in zf.namelist():
                if name.lower().endswith(".fit"):
                    return zf.read(name)
    except zipfile.BadZipFile:
        # alguns downloads ja vem como FIT puro
        if zip_data[:4] == b"\x0e\x10\xd9\x07" or zip_data[:4] == b"\x0e\x10":
            return zip_data
        # tenta FIT pelo magic byte do protocolo
        if len(zip_data) > 12 and zip_data[8:12] == b".FIT":
            return zip_data
    return None


def _update_integration(
    db: Session,
    integration: UserIntegration,
    status: str,
    error: str | None,
) -> None:
    integration.last_sync_at = datetime.now(tz=timezone.utc)
    integration.last_sync_status = status
    integration.last_sync_error = error
    integration.updated_at = datetime.now(tz=timezone.utc)
    db.add(integration)
    db.commit()
