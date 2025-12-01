from fastapi import APIRouter, HTTPException, Depends, Request, Query
from typing import List, Optional
from datetime import datetime

from app.core.limiter import limiter

from app.schemas.category import Category, CategoryCreate, CategoryType
from app.schemas.transaction import Transaction, TransactionCreate
from app.schemas.account import Account, AccountCreate
from app.schemas.budget import Budget, BudgetCreate
from app.schemas.dashboard import DashboardSummary
from app.schemas.recurrence import Recurrence, RecurrenceCreate, RecurrenceUpdate

from app.services import category as category_service
from app.services import transaction as transaction_service
from app.services import account as account_service
from app.services import budget as budget_service
from app.services import dashboard as dashboard_service
from app.services import recurrence as recurrence_service

from app.core.security import get_current_user

router = APIRouter()

# --- CONTAS (ACCOUNTS) ---
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
    return transaction_service.create_unified_transaction(transaction, current_user['uid'])

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

from fastapi import APIRouter, HTTPException, Depends, Request, Query
from typing import List, Optional
from datetime import datetime

from app.core.limiter import limiter

from app.schemas.category import Category, CategoryCreate, CategoryType
from app.schemas.transaction import Transaction, TransactionCreate
from app.schemas.account import Account, AccountCreate
from app.schemas.budget import Budget, BudgetCreate
from app.schemas.dashboard import DashboardSummary
from app.schemas.recurrence import Recurrence, RecurrenceCreate, RecurrenceUpdate

from app.services import category as category_service
from app.services import transaction as transaction_service
from app.services import account as account_service
from app.services import budget as budget_service
from app.services import dashboard as dashboard_service
from app.services import recurrence as recurrence_service

from app.core.security import get_current_user

router = APIRouter()

# --- CONTAS (ACCOUNTS) ---
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
    return transaction_service.create_unified_transaction(transaction, current_user['uid'])

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
@limiter.limit("10 per minute")
def update_recurrence(request: Request, recurrence_id: str, recurrence: RecurrenceUpdate, current_user: dict = Depends(get_current_user)):
    return recurrence_service.update_recurrence(recurrence_id, recurrence, current_user['uid'])

@router.patch("/recurrences/{recurrence_id}/cancel", response_model=Recurrence)
def cancel_recurrence(recurrence_id: str, current_user: dict = Depends(get_current_user)):
    return recurrence_service.cancel_recurrence(recurrence_id, current_user['uid'])