from fastapi import APIRouter, HTTPException
from typing import List

from app.schemas.category import Category, CategoryCreate
from app.schemas.transaction import Transaction, TransactionCreate
from app.services import category as category_service
from app.services import transaction as transaction_service
from app.schemas.account import Account, AccountCreate
from app.services import account as account_service


router = APIRouter()

# --- Rotas de Categorias ---

@router.post("/categories/", response_model=Category)
def create_new_category(category: CategoryCreate):
    return category_service.create_category(category)

@router.get("/categories/", response_model=List[Category])
def read_categories():
    return category_service.list_categories()


# --- Rotas de Transações ---

@router.post("/transactions/", response_model=Transaction)
def create_new_transaction(transaction: TransactionCreate):
    return transaction_service.create_transaction(transaction)

@router.get("/transactions/", response_model=List[Transaction])
def read_transactions():
    return transaction_service.list_transactions()


# --- ROTAS DE CONTAS (ACCOUNTS) ---

@router.post("/accounts/", response_model=Account)
def create_new_account(account: AccountCreate):
    return account_service.create_account(account)

@router.get("/accounts/", response_model=List[Account])
def read_accounts():
    return account_service.list_accounts()