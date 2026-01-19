from fastapi import APIRouter, Depends, Query, HTTPException
from typing import List, Optional
from app.services.analysis_service import analysis_service
from app.services import user_preference as preference_service
from app.core.security import get_current_user

# Router setup
router = APIRouter()

@router.get("/subscriptions", response_model=List[dict])
def get_subscription_suggestions(
    user_id: str = Query(..., description="ID do usuário"),
    current_user: dict = Depends(get_current_user) # Needed for security/tier check
):
    """
    Zombie Hunter: Detecta possíveis assinaturas recorrentes não cadastradas.
    """
    # Verify Tier (Premium Feature)
    prefs = preference_service.get_preferences(current_user['uid'])
    tier = prefs.subscription_tier or 'free'
    
    if tier != 'premium':
         raise HTTPException(status_code=403, detail="Feature 'Zombie Hunter' is available only for Premium users.")

    suggestions = analysis_service.detect_subscriptions(user_id)
    return suggestions
