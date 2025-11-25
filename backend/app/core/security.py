from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth

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
        print(f"Erro na autenticação: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )