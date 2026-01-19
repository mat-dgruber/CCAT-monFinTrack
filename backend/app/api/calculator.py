from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import List, Optional
from datetime import date

from app.services.debt_calculator_service import DebtCalculatorService

router = APIRouter()

class PresentValueRequest(BaseModel):
    parcel_value: float
    monthly_interest_rate: float
    due_date: date
    payment_date: Optional[date] = None

class InstallmentItem(BaseModel):
    number: int
    value: float
    due_date: date

class BulkAmortizationRequest(BaseModel):
    extra_balance: float
    installments: List[InstallmentItem]
    monthly_interest_rate: float

@router.post("/calculator/present-value", summary="Calcula desconto por antecipação (Valor Presente)")
def calculate_present_value(req: PresentValueRequest):
    """
    Calcula o valor presente de uma parcela futura trazida a valor presente.
    Útil para antecipação de parcelas de empréstimos/financiamentos.
    """
    try:
        result = DebtCalculatorService.calculate_present_value(
            parcel_value=req.parcel_value,
            monthly_interest_rate=req.monthly_interest_rate,
            due_date=req.due_date,
            payment_date=req.payment_date
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/calculator/bulk-amortization", summary="Simula amortização em massa (de tras pra frente)")
def simulate_bulk_amortization(req: BulkAmortizationRequest):
    """
    Simula quantas parcelas (do final do contrato) é possível quitar com um saldo extra.
    """
    try:
        # Convert Pydantic models to dicts expected by service
        installments_dicts = [i.model_dump() for i in req.installments]
        
        result = DebtCalculatorService.simulate_bulk_amortization(
            extra_balance=req.extra_balance,
            installments=installments_dicts,
            monthly_interest_rate=req.monthly_interest_rate
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
