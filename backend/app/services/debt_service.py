from typing import List, Optional, Dict, Any
from datetime import datetime, date
from dateutil.relativedelta import relativedelta
from fastapi import HTTPException

from app.core.database import get_db
from app.schemas.debt import Debt, DebtCreate, DebtUpdate, PaymentPlan, PaymentStep, DebtPayoffSummary
from app.models.debt import DebtType, InterestPeriod
from app.services.user_preference import get_preferences

COLLECTION_NAME = "debts"

def check_tier_eligibility(user_id: str):
    """
    Blocks access for 'free' users to write/calc operations if required.
    For now, we enforce this at the service level for plan generation or creating debts beyond a limit?
    Plan says: Free = No access. PRO = Manual. Premium = AI.
    """
    pref = get_preferences(user_id)
    if pref.subscription_tier == 'free':
        raise HTTPException(status_code=403, detail="Debt Planner is available for PRO and PREMIUM users.")
    return pref.subscription_tier

def create_debt(user_id: str, debt_in: DebtCreate) -> Debt:
    check_tier_eligibility(user_id)
    db = get_db()
    data = debt_in.model_dump()
    data['user_id'] = user_id
    data['created_at'] = datetime.now().isoformat()
    
    update_time, doc_ref = db.collection(COLLECTION_NAME).add(data)
    return Debt(id=doc_ref.id, **data)

def list_debts(user_id: str) -> List[Debt]:
    # Free users might see 'readonly' or empty? Plan says "No access".
    # But for upsell they might see summary. Let's allow listing but block calc/add.
    # Actually, let's block strict if they shouldn't use it.
    check_tier_eligibility(user_id)
    
    db = get_db()
    docs = db.collection(COLLECTION_NAME).where("user_id", "==", user_id).stream()
    return [Debt(id=doc.id, **doc.to_dict()) for doc in docs]

def get_debt(user_id: str, debt_id: str) -> Debt:
    db = get_db()
    doc = db.collection(COLLECTION_NAME).document(debt_id).get()
    if not doc.exists or doc.to_dict().get('user_id') != user_id:
        raise HTTPException(status_code=404, detail="Debt not found")
    return Debt(id=doc.id, **doc.to_dict())

def update_debt(user_id: str, debt_id: str, debt_in: DebtUpdate) -> Debt:
    check_tier_eligibility(user_id)
    db = get_db()
    doc_ref = db.collection(COLLECTION_NAME).document(debt_id)
    doc = doc_ref.get()
    
    if not doc.exists or doc.to_dict().get('user_id') != user_id:
        raise HTTPException(status_code=404, detail="Debt not found")
        
    data = debt_in.model_dump(exclude_unset=True)
    doc_ref.update(data)
    
    return Debt(id=debt_id, **doc_ref.get().to_dict())

def delete_debt(user_id: str, debt_id: str):
    check_tier_eligibility(user_id)
    db = get_db()
    doc_ref = db.collection(COLLECTION_NAME).document(debt_id)
    doc = doc_ref.get()
    
    if not doc.exists or doc.to_dict().get('user_id') != user_id:
        raise HTTPException(status_code=404, detail="Debt not found")
        
    doc_ref.delete()
    return {"status": "success"}

# --- SIMULATION LOGIC ---

def generate_payment_plan(user_id: str, strategy: str, monthly_budget: float) -> PaymentPlan:
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
            debt_summaries=[]
        )

    # 2. Prepare Simulation State
    sim_debts = []
    for d in debts:
        # Convert rate to monthly
        rate_monthly = d.interest_rate / 100.0
        if d.interest_period == InterestPeriod.YEARLY:
            rate_monthly = ((1 + rate_monthly) ** (1/12)) - 1
            
        sim_debts.append({
            "id": d.id,
            "name": d.name,
            "balance": d.total_amount,
            "rate_monthly": rate_monthly,
            "min_payment": d.minimum_payment or 0.0,
            "initial_balance": d.total_amount,
            "interest_paid_total": 0.0,
            "months_to_payoff": 0,
            "is_paid": False
        })

    # Sort logic for "Targeting"
    # Snowball: Lowest Balance first
    # Avalanche: Highest Rate first
    def get_priority_debt(active_debts):
        if strategy == 'avalanche':
            # Sort by rate DESC
            return sorted(active_debts, key=lambda x: x['rate_monthly'], reverse=True)[0]
        else:
            # Snowball: Sort by balance ASC
            return sorted(active_debts, key=lambda x: x['balance'])[0]

    current_date = date.today()
    steps = []
    total_interest_global = 0.0
    
    # Safety break
    max_months = 360 # 30 years cap
    month_idx = 0
    
    while any(d['balance'] > 0.01 for d in sim_debts) and month_idx < max_months:
        month_idx += 1
        current_date_step = current_date + relativedelta(months=month_idx)
        
        # 1. Accrue Interest & Calculate Minimums
        total_min_required = 0.0
        active_debts = [d for d in sim_debts if not d['is_paid']]
        
        for d in active_debts:
            interest = d['balance'] * d['rate_monthly']
            d['balance'] += interest
            d['interest_paid_total'] += interest
            total_interest_global += interest
            
            # Record interest step? Maybe only payment step
            
            # Min Payment: Usually % of balance or fixed. Use stored min_payment.
            # However, if balance < min_payment, min_payment = balance
            payment = min(d['balance'], d['min_payment'])
            d['current_payment'] = payment
            total_min_required += payment
            
        # 2. Determine Budget
        # If totalmins > budget, we have a problem (underpayment). We assume user pays at least mins.
        available_for_debts = max(monthly_budget, total_min_required)
        extra_cash = available_for_debts - total_min_required
        
        # 3. Pay Minimums
        for d in active_debts:
            pay_amount = d['current_payment']
            d['balance'] -= pay_amount
            
            # Step record (aggregated per debt? or per month?)
            # Usually plan shows one line per month or detailed.
            # We'll generate steps for user history. Too many steps if detail every debt every month.
            # Output format: Grouped by month? Or flat list of interactions?
            # User wants "Plan". Usually: "Month 1: Pay X to A, Y to B."
            
        # 4. Apply Extra (Snowball/Avalanche)
        if extra_cash > 0 and active_debts:
            # Re-check balances after min payment
            active_debts = [d for d in sim_debts if d['balance'] > 0.01]
            if active_debts:
                # Loop to distribute extra if multiple debts get paid off
                while extra_cash > 0 and active_debts:
                    target = get_priority_debt(active_debts)
                    payment = min(target['balance'], extra_cash)
                    target['balance'] -= payment
                    extra_cash -= payment
                    target['current_payment'] += payment # Track total paid this month to this debt
                    
                    if target['balance'] <= 0.01:
                        target['balance'] = 0
                        target['is_paid'] = True
                        target['months_to_payoff'] = month_idx
                        target['payoff_date_iso'] = current_date_step.isoformat()
                        active_debts = [d for d in sim_debts if d['balance'] > 0.01]

        # 5. Create Steps
        # For this month, what was paid where?
        # To avoid 1000s of items, maybe summarize?
        # Or detailed: "Month 1: Debt A - Paid 100. Debt B - Paid 500."
        for d in sim_debts:
            if d.get('current_payment', 0) > 0:
                steps.append(PaymentStep(
                    month_index=month_idx,
                    date=current_date_step.isoformat(),
                    payment_amount=round(d['current_payment'], 2),
                    interest_paid=0.0, # Approximate, tracked in aggregate
                    principal_paid=0.0,
                    remaining_balance=round(d['balance'], 2),
                    debt_id=d['id'],
                    debt_name=d['name']
                ))
                d['current_payment'] = 0 # Reset for next loop

    # Summaries
    summaries = []
    final_date = date.today()
    for d in sim_debts:
        summaries.append(DebtPayoffSummary(
            debt_id=d['id'],
            debt_name=d['name'],
            total_interest_paid=round(d['interest_paid_total'], 2),
            payoff_months=d['months_to_payoff'] if d['is_paid'] else max_months,
            payoff_date=d.get('payoff_date_iso', 'Has not paid off check budget')
        ))
        if d['is_paid'] and d.get('payoff_date_iso'):
            dt = date.fromisoformat(d['payoff_date_iso'])
            if dt > final_date:
                final_date = dt

    return PaymentPlan(
        strategy=strategy,
        monthly_budget=monthly_budget,
        total_interest_paid=round(total_interest_global, 2),
        total_months=month_idx,
        payoff_date=final_date.isoformat(),
        steps=steps, # Frontend can group by Month
        debt_summaries=summaries
    )
