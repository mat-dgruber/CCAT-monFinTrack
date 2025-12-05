from app.core.database import get_db
from app.schemas.account import AccountCreate, Account
from fastapi import HTTPException

COLLECTION_NAME = "accounts"

def create_account(account_in: AccountCreate, user_id: str) -> Account:
    db = get_db()
    data = account_in.model_dump()
    data['user_id'] = user_id # <--- MARCA D'ÁGUA DO DONO
    
    update_time, doc_ref = db.collection(COLLECTION_NAME).add(data)
    return Account(id=doc_ref.id, **data)

# Listar: Só traz as contas DO usuário
def list_accounts(user_id: str) -> list[Account]:
    db = get_db()
    # FILTRO DE SEGURANÇA
    docs = db.collection(COLLECTION_NAME).where("user_id", "==", user_id).stream()
    
    accounts = []
    for doc in docs:
        accounts.append(Account(id=doc.id, **doc.to_dict()))
    return accounts

# Update: Verifica se a conta é do usuário antes de mexer
def update_account(account_id: str, account_in: AccountCreate, user_id: str) -> Account:
    db = get_db()
    doc_ref = db.collection(COLLECTION_NAME).document(account_id)
    doc = doc_ref.get()
    
    if not doc.exists or doc.to_dict().get('user_id') != user_id:
        raise HTTPException(status_code=404, detail="Account not found or access denied")
        
    data = account_in.model_dump()
    data['user_id'] = user_id # Garante que não perde a posse
    doc_ref.update(data)
    
    return Account(id=account_id, **data)

# Delete: Verifica dono
def delete_account(account_id: str, user_id: str):
    db = get_db()
    doc_ref = db.collection(COLLECTION_NAME).document(account_id)
    doc = doc_ref.get()

    if not doc.exists or doc.to_dict().get('user_id') != user_id:
        raise HTTPException(status_code=404, detail="Account not found")

    doc_ref.delete()
from app.core.database import get_db
from app.schemas.account import AccountCreate, Account
from fastapi import HTTPException

COLLECTION_NAME = "accounts"

def create_account(account_in: AccountCreate, user_id: str) -> Account:
    db = get_db()
    data = account_in.model_dump()
    data['user_id'] = user_id # <--- MARCA D'ÁGUA DO DONO
    
    update_time, doc_ref = db.collection(COLLECTION_NAME).add(data)
    return Account(id=doc_ref.id, **data)

# Listar: Só traz as contas DO usuário
def list_accounts(user_id: str) -> list[Account]:
    db = get_db()
    # FILTRO DE SEGURANÇA
    docs = db.collection(COLLECTION_NAME).where("user_id", "==", user_id).stream()
    
    accounts = []
    for doc in docs:
        accounts.append(Account(id=doc.id, **doc.to_dict()))
    return accounts

# Update: Verifica se a conta é do usuário antes de mexer
def update_account(account_id: str, account_in: AccountCreate, user_id: str) -> Account:
    db = get_db()
    doc_ref = db.collection(COLLECTION_NAME).document(account_id)
    doc = doc_ref.get()
    
    if not doc.exists or doc.to_dict().get('user_id') != user_id:
        raise HTTPException(status_code=404, detail="Account not found or access denied")
        
    data = account_in.model_dump()
    data['user_id'] = user_id # Garante que não perde a posse
    doc_ref.update(data)
    
    return Account(id=account_id, **data)

# Delete: Verifica dono
def delete_account(account_id: str, user_id: str):
    db = get_db()
    doc_ref = db.collection(COLLECTION_NAME).document(account_id)
    doc = doc_ref.get()

    if not doc.exists or doc.to_dict().get('user_id') != user_id:
        raise HTTPException(status_code=404, detail="Account not found")

    doc_ref.delete()
    return {"status": "success"}

# Helper para uso interno (Transaction Service usa isso)
def get_account(account_id: str):
    db = get_db()
    doc = db.collection(COLLECTION_NAME).document(account_id).get()
    if doc.exists:
        return Account(id=doc.id, **doc.to_dict())
    return None

def delete_all_accounts(user_id: str):
    db = get_db()
    docs = db.collection(COLLECTION_NAME).where("user_id", "==", user_id).stream()
    
    batch = db.batch()
    count = 0
    deleted_count = 0
    
    for doc in docs:
        batch.delete(doc.reference)
        count += 1
        
        if count >= 400:
            batch.commit()
            batch = db.batch()
            deleted_count += count
            count = 0
            
    if count > 0:
        batch.commit()
        deleted_count += count
        
    return deleted_count