from app.core.database import get_db
from app.schemas.transaction import TransactionCreate, Transaction
from app.schemas.category import Category 
from app.schemas.account import Account 

from app.services import category as category_service
from app.services import account as account_service 
from fastapi import HTTPException

COLLECTION_NAME = "transactions"

def create_transaction(transaction_in: TransactionCreate) -> Transaction:
    db = get_db()
    
    # 1. Verifica Categoria
    category = category_service.get_category(transaction_in.category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    # 2. Verifica Conta 
    account = account_service.get_account(transaction_in.account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # 3. Salva
    data = transaction_in.model_dump()
    update_time, transaction_ref = db.collection(COLLECTION_NAME).add(data)
    
    # 4. Retorna com os dois objetos aninhados
    return Transaction(
        id=transaction_ref.id, 
        category=category, 
        account=account, 
        **data
    )

def list_transactions() -> list[Transaction]:
    db = get_db()
    docs = db.collection(COLLECTION_NAME).order_by("date", direction="DESCENDING").stream()
    
    transactions = []
    for doc in docs:
        data = doc.to_dict()
        
        # Join Categoria
        cat_id = data.get("category_id")
        category = category_service.get_category(cat_id)
        if not category:
             category = Category(id="deleted", name="Categoria Excluída", icon="pi pi-exclamation-triangle", color="#9ca3af", is_custom=False)

        # Join Conta 
        acc_id = data.get("account_id")
        account = account_service.get_account(acc_id)
        
        # Fallback simples se a conta foi deletada
        if not account:
            account = Account(id="deleted", name="Conta Excluída", type="checking", balance=0)

        transactions.append(Transaction(
            id=doc.id, 
            category=category, 
            account=account, 
            **data
        ))
        
    return transactions