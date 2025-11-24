from app.core.database import get_db
from app.schemas.account import AccountCreate, Account

from fastapi import HTTPException

COLLECTION_NAME = "accounts"

def create_account(account_in: AccountCreate) -> Account:
    """
    Cria uma conta.
    """
    db = get_db()
    data = account_in.model_dump()

    update_time, account_ref = db.collection(COLLECTION_NAME).add(data)
    
    return Account(id=account_ref.id, **data)

def get_account(account_id: str) -> Account:
    db = get_db()
    doc = db.collection(COLLECTION_NAME).document(account_id).get()
    if doc.exists:
        return Account(id=doc.id, **doc.to_dict())
    return None

def list_accounts() -> list[Account]:
    db = get_db()
    docs = db.collection(COLLECTION_NAME).stream()
    
    accounts = []
    for doc in docs:
        accounts.append(Account(id=doc.id, **doc.to_dict()))
        
    return accounts

def update_account(account_id: str, account_in: AccountCreate) -> Account:
    db = get_db()
    doc_ref = db.collection(COLLECTION_NAME).document(account_id)
    
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Account not found")
        
    data = account_in.model_dump()
    doc_ref.update(data)
    return Account(id=account_id, **data)

def delete_account(account_id: str):
    db = get_db()
    # Nota: Em um app real, verificaríamos se há transações vinculadas antes de deletar
    db.collection(COLLECTION_NAME).document(account_id).delete()
    return {"status": "success"}