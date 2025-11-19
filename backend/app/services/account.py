from app.core.database import get_db
from app.schemas.account import AccountCreate, Account

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