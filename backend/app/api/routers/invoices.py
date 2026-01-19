from fastapi import APIRouter, Depends, Query, Body, HTTPException
from typing import List, Optional
from app.core.security import get_current_user
from app.schemas.invoice import InvoiceSummary
from app.services import invoice as invoice_service

router = APIRouter()

@router.get("/", response_model=List[InvoiceSummary])
def get_my_invoices(
    current_user: dict = Depends(get_current_user)
):
    """
    Lista todas as faturas (Abertas, Fechadas) de todos os cartões.
    """
    user_id = current_user['uid']
    
    # Tier Check (Pro+)
    from app.services import user_preference as preference_service
    prefs = preference_service.get_preferences(user_id)
    tier = prefs.subscription_tier or 'free'
    
    if tier == 'free':
         # Allows 'get' maybe? Use cases say "Management". 
         # Request: "Gerenciamento de Cartão de Crédito/fatura para pro ou superiores"
         # This usually implies seeing the dashboard.
         raise HTTPException(status_code=403, detail="Credit Card & Invoice Management is available for Pro and Premium users.")

    return invoice_service.get_invoices(user_id)

@router.post("/pay")
def pay_invoice(
    payload: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Registra pagamento de fatura.
    Payload: { credit_card_id, amount, source_account_id, payment_date?, description? }
    """
    user_id = current_user['uid']
    return invoice_service.pay_invoice(user_id, payload)
