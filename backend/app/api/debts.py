# app/api/debs.py
from typing import List

from app.core.security import get_current_user
from app.models.debt import AmortizationSystem
from app.schemas.debt import Debt, DebtCreate, DebtUpdate, PaymentPlan
from app.services.ai_service import generate_debt_advice
from app.services.debt_service import (
    create_debt,
    delete_debt,
    generate_payment_plan,
    get_debt,
    list_debts,
    update_debt,
)
from app.services.document_analysis import DocumentAnalysisService
from app.services.financing_simulator import FinancingSimulator
from fastapi import APIRouter, Depends, File, Query, UploadFile

router = APIRouter(prefix="/debts", tags=["Debts"])

# --- CRUD ---


@router.post("", response_model=Debt)
def create_debt_endpoint(
    debt_in: DebtCreate, current_user: dict = Depends(get_current_user)
):
    from app.core.logger import get_logger

    logger = get_logger(__name__)
    logger.info("Endpoint POST /api/debts chamado por usuário: %s", current_user["uid"])
    return create_debt(current_user["uid"], debt_in)


@router.get("", response_model=List[Debt])
def list_debts_endpoint(current_user: dict = Depends(get_current_user)):
    return list_debts(current_user["uid"])


@router.get("/{debt_id}", response_model=Debt)
def get_debt_endpoint(debt_id: str, current_user: dict = Depends(get_current_user)):
    return get_debt(current_user["uid"], debt_id)


@router.put("/{debt_id}", response_model=Debt)
def update_debt_endpoint(
    debt_id: str, debt_in: DebtUpdate, current_user: dict = Depends(get_current_user)
):
    return update_debt(current_user["uid"], debt_id, debt_in)


@router.delete("/{debt_id}")
def delete_debt_endpoint(debt_id: str, current_user: dict = Depends(get_current_user)):
    return delete_debt(current_user["uid"], debt_id)


# --- PLANNER & SIMULATION ---


@router.post("/plan", response_model=PaymentPlan)
def generate_plan_endpoint(
    strategy: str = Query(
        ...,
        regex="^(snowball|avalanche)$",
        description="Strategy: 'snowball' (lowest balance first) or 'avalanche' (highest interest first).",
    ),
    monthly_budget: float = Query(
        ..., gt=0, description="Amount available per month for debt repayment."
    ),
    current_user: dict = Depends(get_current_user),
):
    """
    Simulates a debt payoff plan based on a chosen strategy (Snowball vs Avalanche).

    - **Snowball**: Prioritizes paying off smallest debts first to build momentum.
    - **Avalanche**: Prioritizes paying off highest interest debts first to save money.

    Returns a detailed month-by-month payment schedule and payoff summary.
    """
    return generate_payment_plan(current_user["uid"], strategy, monthly_budget)


@router.get("/defaults/housing")
def get_housing_defaults(income: float = Query(..., gt=0)):
    """
    Returns Smart Defaults for Housing Financing based on MCMV (Minha Casa Minha Vida) brackets.
    Calculates estimated interest rates and max property values for a given income.
    """
    return FinancingSimulator.get_mcmv_defaults(income)


@router.post("/simulation/housing")
def simulate_housing(
    property_value: float = Query(..., gt=0),
    entry_value: float = Query(..., ge=0),
    interest_rate_yearly: float = Query(..., ge=0),
    months: int = Query(..., gt=0),
    system: AmortizationSystem = Query(default=AmortizationSystem.SAC),
):
    """
    Simulates a Housing Financing scenario.

    - Supports **SAC** (Decreasing installments) and **Price** (Fixed installments) systems.
    - Returns detailed installment breakdown, total interest, and total paid.
    """
    return FinancingSimulator.simulate_simulation(
        property_value, entry_value, interest_rate_yearly, months, system
    )


from app.services.debt_calculator_service import DebtCalculatorService


@router.get("/simulation/amortization")
def simulate_extra_amortization(
    balance: float = Query(..., gt=0),
    rate_monthly: float = Query(..., ge=0),
    installment: float = Query(..., gt=0),
    extra_amount: float = Query(..., gt=0),
    system: str = Query("price"),
):
    """
    Simulates impact of extra payment comparing term reduction vs installment reduction.
    """
    return DebtCalculatorService.simulate_amortization_impact(
        balance, rate_monthly, installment, extra_amount, system
    )


@router.get("/simulation/anticipate-multiple")
def simulate_multiple_parcels(
    rate_monthly: float = Query(..., ge=0),
    installment: float = Query(..., gt=0),
    count: int = Query(..., gt=0),
):
    """
    Simulates anticipation of next X installments.
    """
    return DebtCalculatorService.simulate_multiple_parcels(
        rate_monthly, installment, count
    )


@router.get("/simulation/revolving")
def simulate_revolving_credit(
    balance: float = Query(..., gt=0, description="Saldo atual no rotativo"),
    rate_monthly: float = Query(..., ge=0, description="Taxa mensal %"),
    minimum_pct: float = Query(default=15.0, description="% mínimo da fatura"),
    fixed_payment: float = Query(default=0.0, description="Valor fixo alternativo"),
):
    """
    Simula o estrago do cartão rotativo / cheque especial.
    Mostra projeção pagando mínimo vs valor fixo vs quitar hoje.
    """
    return DebtCalculatorService.simulate_revolving(
        balance, rate_monthly / 100, minimum_pct / 100, fixed_payment
    )


@router.get("/alerts/{debt_id}")
def get_debt_alerts(debt_id: str, current_user: dict = Depends(get_current_user)):
    """
    Retorna alertas específicos para uma dívida (IPVA, seguro, gravame, FGTS, subsídio...).
    """
    from app.services.debt_alert_service import DebtAlertService

    debt = get_debt(current_user["uid"], debt_id)
    return DebtAlertService.get_alerts(debt)


# --- PREMIUM ANALYSIS ---


@router.post("/analyze")
def analyze_document_endpoint(
    file: UploadFile = File(...), current_user: dict = Depends(get_current_user)
):
    """
    **[PREMIUM] AI Debt Scanner**

    Analyzes a uploaded debt document (PDF/Image) using Google Gemini AI.

    Extracted Fields:
    - Creditor Name
    - Outstanding Balance
    - Interest Rate (Monthly/Yearly)
    - Debt Type (Credit Card, Loan, etc.)
    - Installment details

    Useful for quick import of complex debt contracts.
    """
    content = file.file.read()
    return DocumentAnalysisService.analyze_debt_document(
        current_user["uid"], content, file.content_type
    )


@router.post("/advice")
def get_advice_endpoint(
    monthly_surplus: float = Query(..., ge=0),
    current_user: dict = Depends(get_current_user),
):
    """
    **[PREMIUM] AI Debt Advisor**

    Generates a holistic Debt Payoff Strategy using AI.
    Analyzes all current debts and the user's monthly surplus to provide personalized advice on:
    - Which debt to tackle first (beyond simple math).
    - Negotiation tips.
    - Consolidation opportunities.
    """
    # 1. Get current debts
    debts = list_debts(current_user["uid"])
    debts_data = [d.model_dump() for d in debts]

    # 2. Call AI
    advice = generate_debt_advice(current_user["uid"], debts_data, monthly_surplus)

    return {"advice": advice}
