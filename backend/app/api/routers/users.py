from fastapi import APIRouter, Depends, HTTPException
from app.services import category as category_service
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
        
        return {"status": "success", "message": "User setup completed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
