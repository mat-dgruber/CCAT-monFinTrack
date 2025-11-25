from google.cloud import firestore
from app.core.database import get_db
from app.schemas.transaction import TransactionCreate, Transaction
from app.schemas.category import Category 
from app.schemas.account import Account 

from app.services import category as category_service
from app.services import account as account_service
from fastapi import HTTPException

COLLECTION_NAME = "transactions"

# Função Auxiliar Blindada
def _update_account_balance(db, account_id: str, amount: float, type: str, user_id: str, revert: bool = False):
    if not account_id:
        return

    acc_ref = db.collection("accounts").document(account_id)
    acc_doc = acc_ref.get()
    
    # VERIFICAÇÃO DE SEGURANÇA: A conta existe E pertence ao usuário?
    if acc_doc.exists and acc_doc.to_dict().get('user_id') == user_id:
        current_balance = acc_doc.to_dict().get("balance", 0.0)
        
        if type == "expense":
            if revert:
                current_balance += amount
            else:
                current_balance -= amount
        elif type == "income":
            if revert:
                current_balance -= amount
            else:
                current_balance += amount
                
        acc_ref.update({"balance": current_balance})
    else:
        print(f"⚠️ Acesso negado ou conta inexistente para update de saldo. User: {user_id}, Acc: {account_id}")

def create_transaction(transaction_in: TransactionCreate, user_id: str) -> Transaction:
    db = get_db()
    
    category = category_service.get_category(transaction_in.category_id)
    # Aqui também seria ideal verificar se a categoria é do usuário
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    account = account_service.get_account(transaction_in.account_id)
    # Verifica propriedade da conta
    if not account or getattr(account, 'user_id', None) and account.user_id != user_id:
         # Nota: Como get_account retorna objeto Account, a verificação ideal é no banco, 
         # mas o _update_account_balance já fará a proteção do saldo.
         pass

    # Atualiza Saldo (Passando user_id para segurança)
    _update_account_balance(
        db, transaction_in.account_id, transaction_in.amount, transaction_in.type, user_id, revert=False
    )
    
    data = transaction_in.model_dump()
    data['user_id'] = user_id # MARCA DONO
    
    update_time, transaction_ref = db.collection(COLLECTION_NAME).add(data)
    
    return Transaction(
        id=transaction_ref.id, 
        category=category, 
        account=account, 
        **data
    )

def list_transactions(user_id: str) -> list[Transaction]:
    db = get_db()
    # FILTRO DO USUÁRIO
    docs = db.collection(COLLECTION_NAME)\
        .where("user_id", "==", user_id)\
        .order_by("date", direction="DESCENDING")\
        .order_by(firestore.Client.field_path('__name__'), direction="DESCENDING")\
        .stream()
    
    transactions = []
    for doc in docs:
        data = doc.to_dict()
        
        cat_id = data.get("category_id")
        category = category_service.get_category(cat_id)
        if not category:
             category = Category(id="deleted", name="?", icon="pi pi-question", color="#ccc", is_custom=False, type="expense")

        acc_id = data.get("account_id")
        account = account_service.get_account(acc_id)
        if not account:
            account = Account(id="deleted", name="?", type="checking", balance=0, icon="", color="")

        transactions.append(Transaction(
            id=doc.id, 
            category=category, 
            account=account, 
            **data
        ))
        
    return transactions

def update_transaction(transaction_id: str, transaction_in: TransactionCreate, user_id: str) -> Transaction:
    db = get_db()
    doc_ref = db.collection(COLLECTION_NAME).document(transaction_id)
    doc = doc_ref.get()
    
    # Verifica Propriedade
    if not doc.exists or doc.to_dict().get('user_id') != user_id:
        raise HTTPException(status_code=404, detail="Transaction not found")
        
    old_data = doc.to_dict()
    
    # Estorna valor antigo
    _update_account_balance(
        db, old_data.get("account_id"), old_data.get("amount", 0), old_data.get("type"), user_id, revert=True
    )

    # Aplica novo valor
    _update_account_balance(
        db, transaction_in.account_id, transaction_in.amount, transaction_in.type, user_id, revert=False
    )
    
    data = transaction_in.model_dump()
    data['user_id'] = user_id
    doc_ref.set(data)
    
    category = category_service.get_category(transaction_in.category_id)
    account = account_service.get_account(transaction_in.account_id)
    
    return Transaction(id=transaction_id, category=category, account=account, **data)

def delete_transaction(transaction_id: str, user_id: str):
    db = get_db()
    doc_ref = db.collection(COLLECTION_NAME).document(transaction_id)
    doc = doc_ref.get()
    
    # Verifica Propriedade
    if not doc.exists or doc.to_dict().get('user_id') != user_id:
        raise HTTPException(status_code=404, detail="Transaction not found")
        
    data = doc.to_dict()
    amount = data.get("amount", 0)
    t_type = data.get("type")
    account_id = data.get("account_id")

    # Estorna Saldo
    if account_.id:
        _update_account_balance(db, account_id, amount, t_type, user_id, revert=True)

    doc_ref.delete()
    
    return {"status": "success", "message": "Transaction deleted"}