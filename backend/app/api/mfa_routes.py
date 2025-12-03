from fastapi import APIRouter, Depends, HTTPException, Body
from app.core.security import get_current_user
from app.services.mfa import mfa_service
from pydantic import BaseModel

router = APIRouter()

class MFASetupResponse(BaseModel):
    secret: str
    qr_code: str

class MFAVerifyRequest(BaseModel):
    token: str
    secret: str = None # Optional for login verification, required for setup

class MFALoginVerifyRequest(BaseModel):
    token: str

@router.post("/setup", response_model=MFASetupResponse)
def setup_mfa(current_user: dict = Depends(get_current_user)):
    """
    Inicia o processo de setup do MFA.
    Gera um segredo e um QR Code.
    """
    secret = mfa_service.generate_secret()
    email = current_user.get('email', 'user@monfintrack.com')
    qr_code = mfa_service.generate_qr_code(secret, email)
    
    return MFASetupResponse(secret=secret, qr_code=qr_code)

@router.post("/enable")
def enable_mfa(
    data: MFAVerifyRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Verifica o token e ativa o MFA para o usuário.
    """
    if not data.secret:
        raise HTTPException(status_code=400, detail="Secret is required for enabling MFA")

    success = mfa_service.enable_mfa(current_user['uid'], data.secret, data.token)
    if not success:
        raise HTTPException(status_code=400, detail="Invalid token")
    
    return {"message": "MFA enabled successfully"}

@router.post("/disable")
def disable_mfa(current_user: dict = Depends(get_current_user)):
    """
    Desativa o MFA para o usuário.
    """
    mfa_service.disable_mfa(current_user['uid'])
    return {"message": "MFA disabled successfully"}

@router.get("/status")
def get_mfa_status(current_user: dict = Depends(get_current_user)):
    """
    Retorna o status do MFA (ativado/desativado).
    """
    is_enabled = mfa_service.check_mfa_status(current_user['uid'])
    return {"enabled": is_enabled}

@router.post("/verify")
def verify_mfa_login(
    data: MFALoginVerifyRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Verifica o token MFA durante o login (ou re-autenticação).
    """
    # Recupera o segredo do usuário do banco
    secret = mfa_service.get_user_secret(current_user['uid'])
    if not secret:
        raise HTTPException(status_code=400, detail="MFA not enabled for this user")
        
    if mfa_service.verify_token(secret, data.token):
        return {"valid": True}
    else:
        raise HTTPException(status_code=401, detail="Invalid MFA token")
