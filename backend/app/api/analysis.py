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

def calculate_monthly_averages_helper(transactions: List[Any], months_count: int) -> Dict[str, Any]:
    """
    Calculates average spending from a list of transactions.
    """
    if not transactions or months_count == 0:
        return {"total_avg": 0, "by_category": {}}

    total_spent = 0
    category_totals = {}

    for t in transactions:
        # Assuming transaction model has 'amount', 'type', 'category_name'
        # We only care about EXPENSES for cost of living
        # Check if transaction is an expense (negative amount or type='expense')
        # Adjust logic based on actual Transaction model
        
        # In this system, expenses seem to be negative or defined by category type.
        # Let's assume input transactions are already filtered or we check here.
        # Based on previous context, we might need to check logic.
        # Let's assume standard behavior: absolute value of negative amounts for expenses.
        
        amount = 0
        if hasattr(t, 'type') and t.type == 'expense':
             amount = abs(t.amount)
        elif hasattr(t, 'amount') and t.amount < 0:
             amount = abs(t.amount)
        else:
            continue # Skip income or zero

        total_spent += amount
        
        cat_name = "Outros"
        if hasattr(t, 'category_name') and t.category_name:
            cat_name = t.category_name
        elif hasattr(t, 'category') and t.category and hasattr(t.category, 'name'):
            cat_name = t.category.name
            
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
    Calculates Realized Average (from Transactions) and Committed Cost (from Active Recurrences).
    Default range: Last 6 months.
    """
    user_id = current_user['uid']
    
    # Default dates: last 6 months if not provided
    if not end_date:
        end_date = date.today()
    if not start_date:
        start_date = end_date - timedelta(days=180) # Approx 6 months

    # 1. Realized Cost (Transactions)
    # We need a service method to list transactions in range directly as objects
    # Reusing existing service. likely list_transactions returns models.
    # Note: start_date/end_date in service might expect datetime or string.
    
    # Conversion to datetime for service if needed (assuming service handles it or expects datetime)
    dt_start = datetime.combine(start_date, datetime.min.time())
    dt_end = datetime.combine(end_date, datetime.max.time())

    transactions = transaction_service.list_transactions(
        user_id=user_id,
        start_date=dt_start,
        end_date=dt_end,
        limit=10000 # Fetch all in range
    )

    # Calculate number of months involved to average correctly
    # Simple diff in days / 30 or counting distinct months in data? 
    # Let's use simpler: (end_year - start_year) * 12 + (end_month - start_month) + 1
    # Actually, robust way is strictly requested range duration in months
    months_diff = (end_date.year - start_date.year) * 12 + end_date.month - start_date.month + 1
    months_count = max(1, months_diff)

    realized_data = calculate_monthly_averages_helper(transactions, months_count)

    # 2. Committed Cost (Recurrences)
    recurrences = recurrence_service.list_recurrences(user_id=user_id, active_only=True)
    committed_total = 0
    
    for r in recurrences:
        # Calculate monthly equivalent cost
        amount = abs(r.amount) # adhere to expense sign convention
        if r.type != 'expense':
            continue

        if r.periodicity == 'monthly':
            committed_total += amount
        elif r.periodicity == 'weekly':
            committed_total += amount * 4.33 # Approx weeks in month
        elif r.periodicity == 'yearly':
            committed_total += amount / 12
        elif r.periodicity == 'daily': # unlikely but possible
             committed_total += amount * 30

    return {
        "range": {
            "start": start_date,
            "end": end_date,
            "months_count": months_count
        },
        "realized": {
            "average_total": realized_data["total_avg"],
            "by_category": realized_data["by_category"]
        },
        "committed": {
            "total": committed_total
        },
        "total_estimated_monthly": max(realized_data["total_avg"], committed_total) # Simple heuristic or sum? 
        # Actually user wants to see "Realized Avg" vs "Committed".
        # Total cost of living usually is Realized (what you actually spent). 
        # Committed is a baseline "floor".
    }

@router.get("/inflation")
def get_inflation_rate(current_user: dict = Depends(get_current_user)):
    return get_projection_inflation()

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
            cat = t.category_name or "Outros"
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
            cat = t.category_name or "Outros"
            hist_totals[cat] = hist_totals.get(cat, 0) + abs(t.amount)

    # Average divisor = 6
    anomalies = []
    
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
