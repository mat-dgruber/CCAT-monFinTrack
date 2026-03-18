from datetime import datetime
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.services import account as account_service
from app.services import category as category_service
from app.services.user_preference import delete_account_completely
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

router = APIRouter()


@router.post("/setup")
def setup_user_account(current_user: Annotated[dict, Depends(get_current_user)]):
    """
    Endpoint para inicializar a conta do usuário.
    Garante que o documento do usuário e as categorias padrão existam.
    """
    try:
        user_id = current_user["uid"]
        db = get_db()
        
        # 1. Garante que o documento do usuário existe
        user_ref = db.collection("users").document(user_id)
        if not user_ref.get().exists:
            user_ref.set({
                "uid": user_id,
                "email": current_user.get("email"),
                "created_at": datetime.now(),
                "subscription_tier": "free"
            })

        # 2. Garante categorias padrão
        category_service.ensure_default_categories(user_id)

        # 3. Garante conta padrão
        account_service.ensure_default_account(user_id)

        return {"status": "success", "message": "User setup completed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


class FCMTokenRequest(BaseModel):
    token: str


@router.post("/fcm-token")
def update_fcm_token(
    request: FCMTokenRequest, current_user: Annotated[dict, Depends(get_current_user)]
):
    """
    Salva o token FCM do usuário para notificações push.
    Adiciona à lista 'fcm_tokens' sem duplicatas.
    """
    try:
        user_id = current_user["uid"]
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
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/me")
def delete_my_data(current_user: Annotated[dict, Depends(get_current_user)]):
    """
    LGPD/GDPR compliant Hard Delete of all user data.
    """
    user_id = current_user["uid"]
    return delete_account_completely(user_id)
