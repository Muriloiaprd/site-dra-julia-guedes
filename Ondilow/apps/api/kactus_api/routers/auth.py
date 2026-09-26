from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select

from kactus_api.config import settings
from kactus_api.deps import CurrentUser, DbSession
from kactus_api.models import User
from kactus_api.rate_limit import limiter
from kactus_api.schemas.auth import ChangePasswordIn, RegisterIn, Token, UserOut
from kactus_api.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
def login(
    request: Request,
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: DbSession,
) -> Token:
    user = db.execute(select(User).where(User.email == form.username)).scalar_one_or_none()
    if user is None or not verify_password(form.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha invalidos",
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuario inativo")

    user.last_login_at = datetime.now(UTC)
    db.commit()

    return Token(access_token=create_access_token(str(user.id)))


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterIn, db: DbSession) -> User:
    if not settings.allow_registration:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Registro desabilitado",
        )
    exists = db.execute(select(User).where(User.email == payload.email)).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email ja cadastrado")

    user = User(email=payload.email, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/me", response_model=UserOut)
def me(current_user: CurrentUser) -> User:
    return current_user


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(payload: ChangePasswordIn, current_user: CurrentUser, db: DbSession) -> None:
    """Troca a senha do usuario logado. Nao invalida sessoes ja emitidas em
    outros aparelhos (nao ha blacklist de token nem `tokens_valid_from`) — o
    token antigo continua valido ate expirar (ate 7 dias)."""
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Senha atual incorreta")
    current_user.password_hash = hash_password(payload.new_password)
    db.commit()


@router.delete("/account", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(current_user: CurrentUser, db: DbSession) -> None:
    """Apaga permanentemente a conta e todos os dados do usuario. Cascata no
    banco (ON DELETE CASCADE em todo user_id) remove perfil, integracoes,
    atividades (+ pontos/laps), recordes, metricas diarias, equipamentos,
    treinos planejados e interacoes do coach. Sem confirmacao adicional no
    backend -- a UI e responsavel pela confirmacao, mesmo padrao de
    DELETE /activities (delete_all_activities)."""
    db.delete(current_user)
    db.commit()
