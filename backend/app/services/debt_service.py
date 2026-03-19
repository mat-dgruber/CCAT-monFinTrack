# app/services/debt_service.py
from datetime import date, datetime, timezone
from typing import Any, Dict, List

from app.core.database import get_db
from app.models.debt import InterestPeriod
from app.schemas.debt import (
    Debt,
    DebtCreate,
    DebtPayoffSummary,
    DebtUpdate,
    PaymentPlan,
    PaymentStep,
)
from app.services.debt_calculator_service import DebtCalculatorService
from app.services.user_preference import get_preferences
from dateutil.relativedelta import relativedelta
from fastapi import HTTPException
from google.cloud.firestore_v1 import FieldFilter

COLLECTION_NAME = "debts"


def check_tier_eligibility(user_id: str):
    """
    Blocks access for 'free' users to write/calc operations if required.
    For now, we enforce this at the service level for plan generation or creating debts beyond a limit?
    Plan says: Free = No access. PRO = Manual. Premium = AI.
    """
    pref = get_preferences(user_id)
    if pref.subscription_tier == "free":
        raise HTTPException(
            status_code=403,
            detail="Debt Planner is available for PRO and PREMIUM users.",
        )
    return pref.subscription_tier


def create_debt(user_id: str, debt_in: DebtCreate) -> Debt:
    from app.core.logger import get_logger

    service_logger = get_logger(__name__)

    check_tier_eligibility(user_id)
    db = get_db()

    # Converte para dict usando mode='json' para garantir que objetos date/datetime
    # sejam serializados como strings ISO antes de irem para o Firestore.
    data = debt_in.model_dump(mode="json")

    # Log dos dados para depuração de 500 errors
    service_logger.info("Tentando criar dívida para usuário %s: %s", user_id, data)

    # Prepara metadados
    data["user_id"] = user_id
    data["created_at"] = datetime.now(timezone.utc).isoformat()

    try:
        update_time, doc_ref = db.collection(COLLECTION_NAME).add(data)
        service_logger.info("Dívida criada com sucesso no Firestore: %s", doc_ref.id)
        return get_debt(user_id, doc_ref.id)
    except Exception as e:
        service_logger.error(
            "Erro CRÍTICO ao adicionar dívida no Firestore: %s", e, exc_info=True
        )
        raise e


def list_debts(user_id: str) -> List[Debt]:
    # Free users might see 'readonly' or empty? Plan says "No access".
    # But for upsell they might see summary. Let's allow listing but block calc/add.
    # Actually, let's block strict if they shouldn't use it.
    check_tier_eligibility(user_id)

    db = get_db()
    docs = (
        db.collection(COLLECTION_NAME)
        .where(filter=FieldFilter("user_id", "==", user_id))
        .stream()
    )
    debts = []
    for doc in docs:
        d_dict = doc.to_dict()
        debt_obj = Debt(id=doc.id, **d_dict)
        # Calculate stats
        try:
            stats = DebtCalculatorService.calculate_debt_stats(debt_obj)
            debt_obj.stats = stats
        except Exception:
            # Silent fail for stats, don't break the whole list
            pass
        debts.append(debt_obj)
    return debts


def get_debt(user_id: str, debt_id: str) -> Debt:
    db = get_db()
    doc = db.collection(COLLECTION_NAME).document(debt_id).get()
    if not doc.exists or doc.to_dict().get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="Debt not found")

    d_dict = doc.to_dict()
    debt_obj = Debt(id=doc.id, **d_dict)
    # Calculate stats
    try:
        stats = DebtCalculatorService.calculate_debt_stats(debt_obj)
        debt_obj.stats = stats
    except Exception:
        pass

    return debt_obj


def update_debt(user_id: str, debt_id: str, debt_in: DebtUpdate) -> Debt:
    check_tier_eligibility(user_id)
    db = get_db()
    doc_snapshot = db.collection(COLLECTION_NAME).document(debt_id).get()
    if not doc_snapshot.exists or doc_snapshot.to_dict().get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="Debt not found")

    doc_ref = doc_snapshot.reference
    current_data = doc_snapshot.to_dict()

    # Serialize to JSON mode to ensure dates are strings for Firestore
    data = debt_in.model_dump(exclude_unset=True, mode="json")
    doc_ref.update(data)

    # Reconstruct Debt object without another read
    current_data.update(data)
    debt_obj = Debt(id=debt_id, **current_data)
    # Calculate stats
    try:
        stats = DebtCalculatorService.calculate_debt_stats(debt_obj)
        debt_obj.stats = stats
    except Exception:
        pass

    return debt_obj


def delete_debt(user_id: str, debt_id: str):
    check_tier_eligibility(user_id)
    db = get_db()
    doc_snapshot = db.collection(COLLECTION_NAME).document(debt_id).get()
    if not doc_snapshot.exists or doc_snapshot.to_dict().get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="Debt not found")

    doc_snapshot.reference.delete()
    return {"status": "success"}


# --- SIMULATION LOGIC ---


def generate_payment_plan(
    user_id: str, strategy: str, monthly_budget: float
) -> PaymentPlan:
    check_tier_eligibility(user_id)

    # 1. Fetch Debts
    debts = list_debts(user_id)
    if not debts:
        return PaymentPlan(
            strategy=strategy,
            monthly_budget=monthly_budget,
            total_interest_paid=0.0,
            total_months=0,
            payoff_date=date.today().isoformat(),
            steps=[],
            debt_summaries=[],
        )

    # 2. Prepare Simulation State
    sim_debts = []
    for d in debts:
        # Convert rate to monthly
        rate_monthly = d.interest_rate / 100.0
        if d.interest_period == InterestPeriod.YEARLY:
            rate_monthly = ((1 + rate_monthly) ** (1 / 12)) - 1

        sim_debts.append(
            {
                "id": d.id,
                "name": d.name,
                "balance": d.total_amount,
                "rate_monthly": rate_monthly,
                "min_payment": d.minimum_payment or 0.0,
                "initial_balance": d.total_amount,
                "interest_paid_total": 0.0,
                "months_to_payoff": 0,
                "is_paid": False,
            }
        )

    # Sort logic for "Targeting"
    # Snowball: Lowest Balance first
    # Avalanche: Highest Rate first
    # Sort logic for "Targeting"
    # Snowball: Lowest Balance first
    # Avalanche: Highest Rate first
    def get_priority_debt(active_debts):
        if strategy == "avalanche":
            # Sort by rate DESC
            return sorted(active_debts, key=lambda x: x["rate_monthly"], reverse=True)[
                0
            ]
        else:
            # Snowball: Sort by balance ASC
            return sorted(active_debts, key=lambda x: x["balance"])[0]

    # --- SEASONAL INCOME FETCH ---
    def fetch_seasonal_resources(uid: str) -> List[Dict[str, Any]]:
        db = get_db()
        docs = (
            db.collection("seasonal_incomes")
            .where(filter=FieldFilter("user_id", "==", uid))
            .stream()
        )
        res = []
        for doc in docs:
            d = doc.to_dict()
            # Normalize date
            if "receive_date" in d:
                # Assuming stored as ISO string YYYY-MM-DD based on API
                try:
                    d["date_obj"] = date.fromisoformat(d["receive_date"])
                except (ValueError, TypeError):
                    continue
            res.append(d)
        return res

    seasonal_resources = fetch_seasonal_resources(user_id)
    # -----------------------------

    current_date = date.today()
    steps = []
    total_interest_global = 0.0

    # Validation state
    has_default_warning = False
    has_negative_amortization_warning = False
    warnings = []

    # Safety break
    max_months = 360  # 30 years cap
    month_idx = 0

    while any(d["balance"] > 0.01 for d in sim_debts) and month_idx < max_months:
        current_date_step = current_date + relativedelta(months=month_idx)

        # 1. Accrue Interest & Calculate Minimums
        total_min_required = 0.0
        active_debts = [d for d in sim_debts if not d["is_paid"]]

        for d in active_debts:
            interest = d["balance"] * d["rate_monthly"]
            d["balance"] += interest
            d["interest_paid_total"] += interest
            total_interest_global += interest

            # Min Payment: Usually % of balance or fixed. Use stored min_payment.
            # However, if balance < min_payment, min_payment = balance
            payment = min(d["balance"], d["min_payment"])
            d["current_payment"] = payment
            total_min_required += payment

        # --- APPLY SEASONAL RESOURCES ---
        monthly_bonus = 0.0
        for res in seasonal_resources:
            r_date = res.get("date_obj")
            if not r_date:
                continue

            is_recurrence = res.get("is_recurrence", False)
            match = False

            if is_recurrence:
                if r_date.month == current_date_step.month:
                    match = True
            else:
                if (
                    r_date.month == current_date_step.month
                    and r_date.year == current_date_step.year
                ):
                    match = True

            if match:
                monthly_bonus += float(res.get("amount", 0))
        # --------------------------------

        # 2. Determine Budget & Default Check
        available_this_month = monthly_budget + monthly_bonus

        if available_this_month < total_min_required:
            if not has_default_warning:
                has_default_warning = True
                warnings.append(
                    f"Risco de Inadimplência: O orçamento mensal mais bônus (R$ {available_this_month:.2f}) no mês {month_idx} não cobre os pagamentos mínimos exigidos (R$ {total_min_required:.2f})."
                )

            # Distribute what we have to the minimums (pro-rata could be better, but let's just pay priority ones or fill until empty)
            for d in active_debts:
                if available_this_month <= 0:
                    d["current_payment"] = 0
                elif available_this_month >= d["current_payment"]:
                    available_this_month -= d["current_payment"]
                else:
                    d["current_payment"] = available_this_month
                    available_this_month = 0

            extra_cash = 0.0
        else:
            extra_cash = available_this_month - total_min_required

        # Negative Amortization Check
        for d in active_debts:
            interest_gen = (
                d["balance"] * d["rate_monthly"] / (1 + d["rate_monthly"])
            )  # Backtrack interest added this month
            if (
                d["current_payment"] < interest_gen
                and not has_negative_amortization_warning
            ):
                has_negative_amortization_warning = True
                warnings.append(
                    f"Amortização Negativa: O pagamento da dívida '{d['name']}' não cobre os juros. A dívida está crescendo em vez de diminuir."
                )

        # 3. Pay Minimums
        for d in active_debts:
            pay_amount = d["current_payment"]
            d["balance"] -= pay_amount

        # 4. Apply Extra (Snowball/Avalanche)
        if extra_cash > 0.01:
            active_debts = [d for d in sim_debts if d["balance"] > 0.01]
            if active_debts:
                while extra_cash > 0.01 and active_debts:
                    target = get_priority_debt(active_debts)
                    payment = min(target["balance"], extra_cash)
                    target["balance"] -= payment
                    extra_cash -= payment
                    target["current_payment"] += payment

                    if target["balance"] <= 0.01:
                        target["balance"] = 0
                        target["is_paid"] = True
                        target["months_to_payoff"] = month_idx
                        target["payoff_date_iso"] = current_date_step.isoformat()
                        active_debts = [d for d in sim_debts if d["balance"] > 0.01]

        # 5. Create Steps
        for d in sim_debts:
            if d.get("current_payment", 0) > 0:
                steps.append(
                    PaymentStep(
                        month_index=month_idx,
                        date=current_date_step.isoformat(),
                        payment_amount=round(d["current_payment"], 2),
                        interest_paid=0.0,  # Approximate, could be calculated more precisely
                        principal_paid=0.0,
                        remaining_balance=round(d["balance"], 2),
                        debt_id=d["id"],
                        debt_name=d["name"],
                    )
                )
                d["current_payment"] = 0  # Reset

        month_idx += 1

    # Summaries
    summaries = []
    final_date = date.today()
    for d in sim_debts:
        summaries.append(
            DebtPayoffSummary(
                debt_id=d["id"],
                debt_name=d["name"],
                total_interest_paid=round(d["interest_paid_total"], 2),
                payoff_months=d["months_to_payoff"] if d["is_paid"] else max_months,
                payoff_date=d.get(
                    "payoff_date_iso", "Dívida não foi quitada na simulação"
                ),
            )
        )
        if d["is_paid"] and d.get("payoff_date_iso"):
            dt = date.fromisoformat(d["payoff_date_iso"])
            if dt > final_date:
                final_date = dt

    if not all(d["is_paid"] for d in sim_debts):
        warnings.append(
            "O plano de 30 anos (360 meses) não foi suficiente para quitar todas as dívidas com o orçamento atual."
        )

    return PaymentPlan(
        strategy=strategy,
        monthly_budget=monthly_budget,
        total_interest_paid=round(total_interest_global, 2),
        total_months=month_idx,
        payoff_date=final_date.isoformat(),
        steps=steps,
        debt_summaries=summaries,
        has_default_warning=has_default_warning,
        has_negative_amortization_warning=has_negative_amortization_warning,
        warnings=warnings,
    )
