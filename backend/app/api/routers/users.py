from fastapi import APIRouter, Depends, HTTPException
from app.services import category as category_service
from app.services import account as account_service
from app.core.security import get_current_user

router = APIRouter()

@router.post("/setup")
def setup_user_account(current_user: dict = Depends(get_current_user)):
    """
    Endpoint para inicializar a conta do usuário.
    Garante que as categorias padrão (incluindo as ocultas de sistema) existam.
    """
    try:
        user_id = current_user['uid']
        # Garante categorias padrão
        category_service.ensure_default_categories(user_id)
        
        # Garante conta padrão
        account_service.ensure_default_account(user_id)
        
        return {"status": "success", "message": "User setup completed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from app.core.database import get_db
from pydantic import BaseModel

class FCMTokenRequest(BaseModel):
    token: str

@router.post("/fcm-token")
def update_fcm_token(request: FCMTokenRequest, current_user: dict = Depends(get_current_user)):
    """
    Salva o token FCM do usuário para notificações push.
    Adiciona à lista 'fcm_tokens' sem duplicatas.
    """
    try:
        user_id = current_user['uid']
        token = request.token
        db = get_db()
        user_ref = db.collection("users").document(user_id)
        
        # Obter tokens atuais
        doc = user_ref.get()
        if doc.exists:
            data = doc.to_dict()
            tokens = data.get("fcm_tokens", [])
            if token not in tokens:
                tokens.append(token)
                user_ref.update({"fcm_tokens": tokens})
        else:
            user_ref.set({"fcm_tokens": [token]}, merge=True)
            
        return {"status": "success", "message": "Token saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
