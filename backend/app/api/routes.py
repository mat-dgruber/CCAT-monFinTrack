from fastapi import APIRouter, HTTPException, Depends, Request, Query
from typing import List, Optional
from datetime import datetime

from app.core.limiter import limiter
from app.core.security import get_current_user
from app.api import user_preference

from app.services import (
    account as account_service,
    category as category_service,
    transaction as transaction_service,
    budget as budget_service,
    dashboard as dashboard_service,
    recurrence as recurrence_service
)

from app.schemas.account import Account, AccountCreate
from app.schemas.category import Category, CategoryCreate, CategoryType
from app.schemas.transaction import Transaction, TransactionCreate
from app.schemas.budget import Budget, BudgetCreate
from app.schemas.dashboard import DashboardSummary
from app.schemas.recurrence import Recurrence, RecurrenceCreate, RecurrenceUpdate

router = APIRouter()

@router.post("/accounts", response_model=Account)
@limiter.limit("10 per minute")
def create_new_account(request: Request, account: AccountCreate, current_user: dict = Depends(get_current_user)):
    return account_service.create_account(account, current_user['uid'])

@router.get("/accounts", response_model=List[Account])
def read_accounts(current_user: dict = Depends(get_current_user)):
    return account_service.list_accounts(current_user['uid'])

@router.put("/accounts/{account_id}", response_model=Account)
@limiter.limit("10 per minute")
def update_account(request: Request, account_id: str, account: AccountCreate, current_user: dict = Depends(get_current_user)):
    return account_service.update_account(account_id, account, current_user['uid'])

@router.delete("/accounts/{account_id}")
@limiter.limit("10 per minute")
def delete_account(request: Request, account_id: str, current_user: dict = Depends(get_current_user)):
    return account_service.delete_account(account_id, current_user['uid'])

# --- CATEGORIAS ---
@router.post("/categories", response_model=Category)
@limiter.limit("10 per minute")
def create_new_category(request: Request, category: CategoryCreate, current_user: dict = Depends(get_current_user)):
    return category_service.create_category(category, current_user['uid'])

@router.get("/categories", response_model=List[Category])
def read_categories(type: Optional[CategoryType] = None, current_user: dict = Depends(get_current_user)):
    return category_service.list_categories(current_user['uid'], cat_type=type)

@router.put("/categories/{category_id}", response_model=Category)
@limiter.limit("10 per minute")
def update_category(request: Request, category_id: str, category: CategoryCreate, current_user: dict = Depends(get_current_user)):
    return category_service.update_category(category_id, category, current_user['uid'])

@router.delete("/categories/{category_id}")
@limiter.limit("10 per minute")
def delete_category(request: Request, category_id: str, current_user: dict = Depends(get_current_user)):
    return category_service.delete_category(category_id, current_user['uid'])


# --- TRANSAÇÕES ---
@router.post("/transactions", response_model=List[Transaction])
@limiter.limit("10 per minute")
def create_new_transaction(request: Request, transaction: TransactionCreate, current_user: dict = Depends(get_current_user)):
    # 1. Create Transaction (Unified)
    created_txs = transaction_service.create_unified_transaction(transaction, current_user['uid'])
    
    # 2. Analyze for Anomalies (Zero Cost)
    # Only analyze the first transaction (if unified, usually the main one)
    if created_txs and transaction.type == 'expense':
        from app.services.analysis_service import analysis_service
        warning = analysis_service.analyze_transaction(
            user_id=current_user['uid'], 
            amount=transaction.amount, 
            category_id=transaction.category_id
        )
        if warning:
            # Inject warning into the response object
            # Pydantic models are immutable-ish, but since we are returning the object/dict, we can set it.
            # But created_txs are Transaction objects.
            created_txs[0].warning = warning

    return created_txs

@router.get("/transactions")
def read_transactions(
    month: Optional[int] = None, 
    year: Optional[int] = None, 
    limit: Optional[int] = None, 
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user: dict = Depends(get_current_user)
):
    transactions = transaction_service.list_transactions(
        user_id=current_user['uid'], 
        month=month, 
        year=year, 
        limit=limit,
        start_date=start_date,
        end_date=end_date
    )
    return [t.model_dump() for t in transactions]

@router.put("/transactions/{transaction_id}", response_model=Transaction)
@limiter.limit("10 per minute")
def update_transaction(request: Request, transaction_id: str, transaction: TransactionCreate, current_user: dict = Depends(get_current_user)):
    return transaction_service.update_transaction(transaction_id, transaction, current_user['uid'])

@router.get("/transactions/upcoming", response_model=List[Transaction])
def read_upcoming_transactions(limit: int = 10, current_user: dict = Depends(get_current_user)):
    return transaction_service.get_upcoming_transactions(current_user['uid'], limit)

@router.delete("/transactions/{transaction_id}")
@limiter.limit("10 per minute")
def delete_transaction(request: Request, transaction_id: str, current_user: dict = Depends(get_current_user)):
    return transaction_service.delete_transaction(transaction_id, current_user['uid'])

# --- BUDGETS ---
@router.post("/budgets", response_model=Budget)
@limiter.limit("10 per minute")
def create_budget(request: Request, budget: BudgetCreate, current_user: dict = Depends(get_current_user)):
    return budget_service.create_budget(budget, current_user['uid'])

@router.get("/budgets", response_model=List[dict])
def read_budgets(month: Optional[int] = None, year: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    return budget_service.list_budgets_with_progress(current_user['uid'], month, year)

@router.delete("/budgets/{budget_id}")
@limiter.limit("10 per minute")
def delete_budget(request: Request, budget_id: str, current_user: dict = Depends(get_current_user)):
    return budget_service.delete_budget(budget_id, current_user['uid'])

@router.put("/budgets/{budget_id}", response_model=Budget)
@limiter.limit("10 per minute")
def update_budget(request: Request, budget_id: str, budget: BudgetCreate, current_user: dict = Depends(get_current_user)):
    return budget_service.update_budget(budget_id, budget, current_user['uid'])

# --- DASHBOARD ---
@router.get("/dashboard", response_model=DashboardSummary)
def get_dashboard_summary(
    month: Optional[int] = None,
    year: Optional[int] = None,
    accounts: Optional[List[str]] = Query(None),
    payment_methods: Optional[List[str]] = Query(None),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user: dict = Depends(get_current_user)
):
    return dashboard_service.get_dashboard_data(
        user_id=current_user['uid'],
        month=month,
        year=year,
        accounts=accounts,
        payment_methods=payment_methods,
        start_date=start_date,
        end_date=end_date
    )

# --- RECORRÊNCIAS ---
@router.post("/recurrences", response_model=Recurrence)
@limiter.limit("10 per minute")
def create_recurrence(request: Request, recurrence: RecurrenceCreate, current_user: dict = Depends(get_current_user)):
    return recurrence_service.create_recurrence(recurrence, current_user['uid'])

@router.get("/recurrences", response_model=List[Recurrence])
def list_recurrences(active_only: bool = False, current_user: dict = Depends(get_current_user)):
    return recurrence_service.list_recurrences(current_user['uid'], active_only=active_only)

@router.put("/recurrences/{recurrence_id}", response_model=Recurrence)
def update_recurrence(recurrence_id: str, recurrence: RecurrenceUpdate, scope: str = "all", current_user: dict = Depends(get_current_user)):
    return recurrence_service.update_recurrence(recurrence_id, recurrence, current_user['uid'], scope)

@router.patch("/recurrences/{recurrence_id}/cancel", response_model=Recurrence)
def cancel_recurrence(recurrence_id: str, current_user: dict = Depends(get_current_user)):
    return recurrence_service.cancel_recurrence(recurrence_id, current_user['uid'])

@router.post("/recurrences/{recurrence_id}/skip", response_model=Recurrence)
def skip_recurrence(
    recurrence_id: str, 
    date_data: dict, # Expecting {"date": "YYYY-MM-DD"}
    current_user: dict = Depends(get_current_user)
):
    """
    Pula uma ocorrência específica de uma recorrência.
    Adiciona a data à lista de skipped_dates.
    """
    try:
        skip_date_str = date_data.get("date")
        if not skip_date_str:
            raise HTTPException(status_code=400, detail="Date is required")
            
        # Parse date
        if isinstance(skip_date_str, str):
            # Handle ISO format with potential time component
            if 'T' in skip_date_str:
                 skip_date = datetime.fromisoformat(skip_date_str.replace('Z', '+00:00')).date()
            else:
                 skip_date = datetime.fromisoformat(skip_date_str).date()
        else:
            skip_date = skip_date_str

        recurrence = recurrence_service.get_recurrence(recurrence_id, current_user['uid'])
        if not recurrence:
            raise HTTPException(status_code=404, detail="Recurrence not found")
            
        # Add to skipped_dates if not present
        current_skipped = recurrence.skipped_dates or []
        if skip_date not in current_skipped:
            current_skipped.append(skip_date)
            
            # Update in DB
            recurrence_service.update_recurrence(
                recurrence_id, 
                RecurrenceUpdate(skipped_dates=current_skipped),
                current_user['uid']
            )
            
        return recurrence_service.get_recurrence(recurrence_id, current_user['uid'])
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from app.api import mfa_routes, analysis
from app.api.routers import invoices, users

router.include_router(mfa_routes.router, prefix="/mfa", tags=["MFA"])
router.include_router(user_preference.router, prefix="/preferences", tags=["User Preferences"])
router.include_router(analysis.router, prefix="/analysis", tags=["Analysis"])
router.include_router(invoices.router, prefix="/invoices", tags=["Invoices"])
router.include_router(users.router, prefix="/users", tags=["Users"])