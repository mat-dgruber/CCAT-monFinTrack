from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
import requests
import statistics

from app.core.security import get_current_user
from app.services import transaction as transaction_service
from app.services import recurrence as recurrence_service
from app.core.database import get_db

router = APIRouter()

# --- HELPER FUNCTIONS ---

def calculate_monthly_averages_helper(transactions: List[Any], months_count: float) -> Dict[str, Any]:
    """
    Calculates average spending from a list of transactions.
    """
    if not transactions or months_count == 0:
        return {"total_avg": 0, "by_category": {}}

    total_spent = 0
    category_totals = {}
    
    # Pre-calculated strict filters
    VALID_TYPES = {'expense'}

    for t in transactions:
        # Strict Type Filtering
        # Explicitly exclude transfers and income. 
        # We rely on 'type' attribute being present and matching 'expense'.
        t_type = getattr(t, 'type', None)
        
        # Handle Enum or String
        if hasattr(t_type, 'value'):
             t_type = t_type.value
        
        # Fallback: If type is None, check sign of amount? Or skip?
        # Safe to skip if we enforce 'expense' type.
        # But let's be robust against 'Expense' vs 'expense'
        if not t_type:
            continue
            
        if t_type.lower() not in VALID_TYPES:
            # print(f"Skipping {t_type} (not in {VALID_TYPES})")
            continue

        # Get Amount (Abs value)
        amount = abs(getattr(t, 'amount', 0))
        
        total_spent += amount
        
        # Robust Category Extraction
        cat_name = "Outros"
        category = getattr(t, 'category', None)
        
        if category:
             # Try Object first
             if hasattr(category, 'name'):
                  cat_name = category.name
             elif isinstance(category, dict):
                  cat_name = category.get('name', "Outros")
        elif hasattr(t, 'category_name') and t.category_name:
             cat_name = t.category_name
            
        category_totals[cat_name] = category_totals.get(cat_name, 0) + amount

    avg_total = total_spent / months_count
    avg_by_category = {k: v / months_count for k, v in category_totals.items()}
    
    return {
        "total_avg": avg_total,
        "by_category": avg_by_category
    }

def get_projection_inflation() -> Dict[str, Any]:
    """
    Fetches IPCA (Series 433) from BCB API.
    Calculates 12-month accumulated inflation.
    Fallback to 4.5%
    """
    api_url = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/12?formato=json"
    fallback_rate = 4.5
    default_response = {
        "rate": fallback_rate, 
        "is_fallback": True, 
        "message": "Não foi possível obter a taxa de inflação atualizada. Usando valor padrão de 4.5%."
    }

    try:
        response = requests.get(api_url, timeout=5)
        response.raise_for_status()
        data = response.json()
        
        if not data or len(data) < 12:
             return default_response

        # Calculate accumulated inflation: (Prod(1 + rate/100) - 1) * 100
        accumulated = 1.0
        for item in data:
            monthly_rate = float(item['valor'])
            accumulated *= (1 + monthly_rate / 100)
        
        final_rate = (accumulated - 1) * 100
        
        return {
            "rate": round(final_rate, 2),
            "is_fallback": False,
            "message": ""
        }

    except Exception as e:
        print(f"Error fetching inflation API: {e}")
        return default_response

# --- ENDPOINTS ---

@router.get("/monthly-averages")
def get_monthly_averages(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Calculates Smart Cost of Living:
    - Committed Cost: Active Recurrences (Fixed).
    - Variable Cost: Average of Non-Recurring Expenses (Variable).
    - Adaptive Timeframe: Uses [Max(6 months ago, First Transaction)] to calculate average.
    """
    user_id = current_user['uid']
    
    # 1. Determine Timeframe (Adaptive)
    if not end_date:
        end_date = date.today()
        
    # Standard 6 months window
    standard_start = end_date - timedelta(days=180)
    
    if not start_date:
        # Try to adapt for new users
        first_tx_date = transaction_service.get_first_transaction_date(user_id)
        
        if first_tx_date:
            # Check if first transaction is LESS than 6 months ago
            # We want the Maximimum of (6 months ago, First Tx Date)
            # Actually we want the latest date between standard_start and first_tx_date to shorten the range?
            # No, if data starts 1 month ago, we want start_date = 1 month ago.
            # So if first_tx_date > standard_start, use first_tx_date.
            
            # Convert first_tx to date (naive)
            first_date_val = first_tx_date.date() if isinstance(first_tx_date, datetime) else first_tx_date
            
            if first_date_val > standard_start:
                start_date = first_date_val
            else:
                start_date = standard_start
        else:
            # No transactions at all
            start_date = standard_start
    
    # Ensure start <= end
    if start_date > end_date:
        start_date = end_date

    # 2. Get Variable Data (History)
    # We fetch ALL expenses in range, then filter out those that are recurrences
    dt_start = datetime.combine(start_date, datetime.min.time())
    dt_end = datetime.combine(end_date, datetime.max.time())

    transactions = transaction_service.list_transactions(
        user_id=user_id,
        start_date=dt_start,
        end_date=dt_end,
        limit=10000 
    )

    # Filter: Expense AND Not Generated from Recurrence
    variable_transactions = []
    for t in transactions:
        t_type = getattr(t, 'type', None)
        if hasattr(t_type, 'value'): t_type = t_type.value
        
        # We only care about EXPENSES for cost of living
        if t_type != 'expense':
            continue
            
        # Is it a recurrence instance?
        # Check recurrence_id (assuming it is populated for auto-generated items OR items linked to recurrence)
        rec_id = getattr(t, 'recurrence_id', None)
        
        # If it has a recurrence_id, it is part of the "Committed" logic (the recurrent plan), 
        # so we EXCLUDE it from the "Variable" average to avoid double counting.
        if rec_id:
            continue
            
        variable_transactions.append(t)

    # Calculate Divisor
    days_diff = (end_date - start_date).days + 1
    months_count = max(1.0, days_diff / 30.4375)
    
    # Calculate Average of Variables
    variable_data = calculate_monthly_averages_helper(variable_transactions, months_count)

    # 3. Get Committed Cost (Active Recurrences)
    recurrences = recurrence_service.list_recurrences(user_id=user_id, active_only=True)
    committed_total = 0
    
    for r in recurrences:
        # Calculate monthly equivalent cost
        amount = abs(r.amount)
        if r.type != 'expense':
            continue

        if r.periodicity == 'monthly':
            committed_total += amount
        elif r.periodicity == 'weekly':
            committed_total += amount * 4.33 # Approx weeks in month
        elif r.periodicity == 'yearly':
            committed_total += amount / 12
        elif r.periodicity == 'daily':
             committed_total += amount * 30

    # Total Cost of Living = Committed (Fixed) + Variable Average
    total_cost_of_living = committed_total + variable_data["total_avg"]

    return {
        "range": {
            "start": start_date,
            "end": end_date,
            "months_count": months_count,
            "mode": "adaptive" if start_date > standard_start else "standard"
        },
        "realized": {
            "average_total": variable_data["total_avg"], # This is now just the VARIABLE part
            "by_category": variable_data["by_category"]
        },
        "committed": {
            "total": committed_total
        },
        "variable_avg": variable_data["total_avg"], # Explicit field for clarity
        "total_estimated_monthly": total_cost_of_living
    }

@router.get("/inflation")
def get_inflation_rate(current_user: dict = Depends(get_current_user)):
    return get_projection_inflation()

@router.get("/subscriptions")
def check_subscriptions(current_user: dict = Depends(get_current_user)):
    from app.services.analysis_service import analysis_service
    return analysis_service.detect_subscriptions(current_user['uid'])

@router.get("/anomalies")
def check_anomalies(
    month: Optional[int] = None,
    year: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Detects spending anomalies for a specific month compared to 6-month average.
    """
    user_id = current_user['uid']
    today = date.today()
    
    target_month = month if month else today.month
    target_year = year if year else today.year

    # 1. Get Target Month Data
    # Construct dates for target month
    dt_start_target = datetime(target_year, target_month, 1)
    if target_month == 12:
        dt_end_target = datetime(target_year + 1, 1, 1) - timedelta(microseconds=1)
    else:
        dt_end_target = datetime(target_year, target_month + 1, 1) - timedelta(microseconds=1)

    target_txs = transaction_service.list_transactions(
        user_id=user_id, start_date=dt_start_target, end_date=dt_end_target, limit=5000
    )
    
    target_totals = {}
    for t in target_txs:
        if hasattr(t, 'type') and t.type == 'expense':
            # Robust Category Name Extraction
            cat = "Outros"
            if t.category:
                 if hasattr(t.category, 'name'):
                      cat = t.category.name
                 elif isinstance(t.category, dict):
                      cat = t.category.get('name', "Outros")
            
            target_totals[cat] = target_totals.get(cat, 0) + abs(t.amount)

    # 2. Get Historical Average (Previous 6 months)
    # Range: [Target - 6 months, Target - 1 day]
    dt_end_hist = dt_start_target - timedelta(days=1)
    dt_start_hist = dt_end_hist - timedelta(days=180) # approx
    
    hist_txs = transaction_service.list_transactions(
        user_id=user_id, start_date=dt_start_hist, end_date=dt_end_hist, limit=10000
    )
    
    hist_totals = {}
    for t in hist_txs:
        if hasattr(t, 'type') and t.type == 'expense':
            # Robust Category Name Extraction
            cat = "Outros"
            if t.category:
                 if hasattr(t.category, 'name'):
                      cat = t.category.name
                 elif isinstance(t.category, dict):
                      cat = t.category.get('name', "Outros")

            hist_totals[cat] = hist_totals.get(cat, 0) + abs(t.amount)

    # Average divisor = 6
    anomalies = []
    
    # Validation: If we have NO history (New User), we cannot detect anomalies effectively.
    # Or if the total history sum is extremely low.
    total_hist_sum = sum(hist_totals.values())
    
    if total_hist_sum < 10: # Arbitrary small threshold
         return []
    
    for cat, current_val in target_totals.items():
        hist_total = hist_totals.get(cat, 0)
        avg_val = hist_total / 6.0
        
        # Threshold: 30% above average AND absolute difference significant (> 50 currency units?)
        # To avoid noise on small values (e.g. avg 10 vs 15)
        if current_val > avg_val * 1.3 and current_val - avg_val > 50:
            severity = 'critical' if current_val > avg_val * 1.6 else 'warning'
            anomalies.append({
                "category": cat,
                "current": current_val,
                "average": avg_val,
                "pct_increase": ((current_val - avg_val) / avg_val) * 100 if avg_val > 0 else 100,
                "severity": severity
            })
            
    return anomalies
