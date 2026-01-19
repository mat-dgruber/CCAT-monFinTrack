from fastapi import APIRouter, Depends, Request, HTTPException, Body, Header
from app.services.stripe_service import StripeService
from app.schemas.stripe import CheckoutSessionCreate, PortalSessionCreate, StripeConfigResponse
from app.api.routes import get_current_user
from typing import Dict, Any

router = APIRouter()
stripe_service = StripeService()

@router.get("/config", response_model=StripeConfigResponse)
async def get_stripe_config():
    import os
    return {"publishable_key": os.getenv("STRIPE_PUBLISHABLE_KEY", "")}

@router.post("/create-checkout-session")
async def create_checkout_session(
    data: CheckoutSessionCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    try:
        user_id = current_user["uid"]
        return stripe_service.create_checkout_session(
            user_id=user_id,
            plan=data.plan,
            success_url=data.success_url,
            cancel_url=data.cancel_url
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/create-portal-session")
async def create_portal_session(
    data: PortalSessionCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    try:
        user_id = current_user["uid"]
        return stripe_service.create_portal_session(
            user_id=user_id,
            return_url=data.return_url
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/webhook")
async def stripe_webhook(request: Request, stripe_signature: str = Header(None)):
    try:
        payload = await request.body()
        return await stripe_service.handle_webhook(payload, stripe_signature)
    except Exception as e:
         raise HTTPException(status_code=400, detail=str(e))
