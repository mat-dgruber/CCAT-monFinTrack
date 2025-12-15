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
