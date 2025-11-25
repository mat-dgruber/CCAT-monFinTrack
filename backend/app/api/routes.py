from fastapi import APIRouter, HTTPException
from typing import List

from app.schemas.category import Category, CategoryCreate
from app.schemas.transaction import Transaction, TransactionCreate
from app.services import category as category_service
from app.services import transaction as transaction_service
from app.schemas.account import Account, AccountCreate
from app.services import account as account_service
from app.schemas.dashboard import DashboardSummary
from app.services import dashboard as dashboard_service
from app.schemas.budget import Budget, BudgetCreate
from app.services import budget as budget_service


router = APIRouter()

# --- ROTA DO DASHBOARD ---
@router.get("/dashboard", response_model=DashboardSummary)
def get_dashboard_summary():
    return dashboard_service.get_dashboard_data()


# --- Rotas de Categorias ---

@router.post("/categories", response_model=Category)
def create_new_category(category: CategoryCreate):
    return category_service.create_category(category)

@router.get("/categories", response_model=List[Category])
def read_categories():
    return category_service.list_categories()
    
@router.put("/categories/{category_id}", response_model=Category)
def update_category(category_id: str, category: CategoryCreate):
    return category_service.update_category(category_id, category)

@router.delete("/categories/{category_id}")
def delete_category(category_id: str):
    return category_service.delete_category(category_id)

# --- Rotas de Transações ---

@router.post("/transactions", response_model=Transaction)
def create_new_transaction(transaction: TransactionCreate):
    return transaction_service.create_transaction(transaction)

@router.get("/transactions", response_model=List[Transaction])
def read_transactions():
    return transaction_service.list_transactions()

@router.put("/transactions/{transaction_id}", response_model=Transaction)
def update_transaction(transaction_id: str, transaction: TransactionCreate):
    return transaction_service.update_transaction(transaction_id, transaction)

@router.delete("/transactions/{transaction_id}")
def delete_transaction(transaction_id: str):
    return transaction_service.delete_transaction(transaction_id)


# --- ROTAS DE CONTAS (ACCOUNTS) ---

@router.post("/accounts", response_model=Account)
def create_new_account(account: AccountCreate):
    return account_service.create_account(account)

@router.get("/accounts", response_model=List[Account])
def read_accounts():
    return account_service.list_accounts()

@router.put("/accounts/{account_id}", response_model=Account)
def update_account(account_id: str, account: AccountCreate):
    return account_service.update_account(account_id, account)

@router.delete("/accounts/{account_id}")
def delete_account(account_id: str):
    return account_service.delete_account(account_id)

# --- BUDGETS (METAS) ---

@router.post("/budgets", response_model=Budget)
def create_budget(budget: BudgetCreate):
    return budget_service.create_budget(budget)

@router.get("/budgets", response_model=List[dict]) # Retorna dict com progresso
def read_budgets():
    return budget_service.list_budgets_with_progress()

@router.put("/budgets/{budget_id}", response_model=Budget)
def update_budget(budget_id: str, budget: BudgetCreate):
    return budget_service.update_budget(budget_id, budget)

@router.delete("/budgets/{budget_id}")
def delete_budget(budget_id: str):
    return budget_service.delete_budget(budget_id)