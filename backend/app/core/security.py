from app.core.logger import get_logger
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth

logger = get_logger(__name__)

# Isso cria o esquema de segurança no Swagger UI (o cadeado)
security = HTTPBearer()


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Valida o token JWT do Firebase e retorna os dados do usuário (payload).
    """
    token = credentials.credentials

    try:
        # Verifica o token com a chave pública do Google
        decoded_token = auth.verify_id_token(token)
        return decoded_token

    except Exception as e:
        logger.warning("Erro na autenticação: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )
