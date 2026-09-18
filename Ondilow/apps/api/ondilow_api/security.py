from datetime import UTC, datetime, timedelta

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from cryptography.fernet import Fernet, InvalidToken
from jose import JWTError, jwt

from ondilow_api.config import settings

_hasher = PasswordHasher()


def hash_password(plain: str) -> str:
    return _hasher.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        _hasher.verify(hashed, plain)
        return True
    except (VerificationError, InvalidHashError):
        # VerificationError cobre senha errada (VerifyMismatchError e subclasse);
        # InvalidHashError cobre hash corrompido/malformado no banco. Os dois
        # devem virar "credenciais invalidas" (401), nao 500.
        return False


def create_access_token(subject: str, expires_minutes: int | None = None) -> str:
    exp = datetime.now(UTC) + timedelta(minutes=expires_minutes or settings.jwt_expire_minutes)
    payload = {"sub": subject, "exp": exp}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError as e:
        raise ValueError("Invalid token") from e


def _fernet() -> Fernet:
    if not settings.fernet_key:
        raise RuntimeError("FERNET_KEY nao configurada no .env")
    return Fernet(settings.fernet_key.encode() if isinstance(settings.fernet_key, str) else settings.fernet_key)


def encrypt_bytes(plain: bytes) -> bytes:
    return _fernet().encrypt(plain)


def decrypt_bytes(cipher: bytes) -> bytes:
    try:
        return _fernet().decrypt(cipher)
    except InvalidToken as e:
        raise ValueError("Dado encriptado invalido") from e
