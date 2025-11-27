from google.cloud import firestore
from app.core.database import get_db
from app.schemas.transaction import TransactionCreate, Transaction, TransactionStatus
from app.schemas.category import Category 
from app.schemas.account import Account 
from app.core.date_utils import get_month_range
from typing import Optional, List
from datetime import datetime
import uuid
from dateutil.relativedelta import relativedelta

from app.services import category as category_service
from app.services import account as account_service
from app.services import recurrence as recurrence_service
from app.schemas.recurrence import RecurrenceCreate, RecurrencePeriodicity
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
    return Transaction(
        id=transaction_ref.id, 
        category=category, 
        account=account, 
        **data
    )

def create_unified_transaction(transaction_in: TransactionCreate, user_id: str) -> List[Transaction]:
    """
    Cria transações unificadas: Simples, Parceladas ou Recorrentes.
    Retorna uma lista de transações criadas (pode ser 1 ou várias).
    """
    created_transactions = []
    
    # Lógica de Parcelamento (Cenário A)
    if transaction_in.total_installments and transaction_in.total_installments > 1:
        group_id = str(uuid.uuid4())
        recurrence_data = RecurrenceCreate(
            name=transaction_in.description,
            amount=transaction_in.amount,
            category_id=transaction_in.category_id,
            account_id=transaction_in.account_id,
            payment_method_id=transaction_in.payment_method.value,
            periodicity=RecurrencePeriodicity(transaction_in.recurrence_periodicity),
            auto_pay=transaction_in.recurrence_auto_pay,
            due_day=transaction_in.date.day,
            active=True
        )
        
        recurrence = recurrence_service.create_recurrence(recurrence_data, user_id)
        
        if transaction_in.recurrence_create_first:
            t_data = transaction_in.model_dump()
            t_data['recurrence_id'] = recurrence.id
            t_create = TransactionCreate(**t_data)
            created_transactions.append(create_transaction(t_create, user_id))
            
        return created_transactions

    # CENÁRIO C: Simples (Default)
    return [create_transaction(transaction_in, user_id)]

def list_transactions(user_id: str, month: Optional[int] = None, year: Optional[int] = None, limit: Optional[int] = None) -> list[Transaction]:
    db = get_db()
    # FILTRO DO USUÁRIO
    query = db.collection(COLLECTION_NAME).where("user_id", "==", user_id)
    all_transactions = query.stream()

    transactions = []
    
    start_date = None
    end_date = None
    if month and year:
        start_date, end_date = get_month_range(month, year)

    for t in all_transactions:
        data = t.to_dict()
        
        # Date Filtering
        if start_date and end_date:
            t_date = data.get("date")
            
            if t_date:
                # If it's a string, try to parse
                if isinstance(t_date, str):
                    try:
                        t_date = datetime.fromisoformat(t_date.replace('Z', '+00:00'))
                    except:
                        pass 
                
                if isinstance(t_date, datetime):
                     # Make naive for comparison if needed
                     if t_date.tzinfo and not start_date.tzinfo:
                          t_date = t_date.replace(tzinfo=None)
                     elif not t_date.tzinfo and start_date.tzinfo:
                          start_date = start_date.replace(tzinfo=None)
                          end_date = end_date.replace(tzinfo=None)
                     
                     if not (start_date <= t_date <= end_date):
                          continue
                else:
                     continue
            else:
                 continue

        cat_id = data.get("category_id")
        category = category_service.get_category(cat_id)
        if not category:
             category = Category(id="deleted", name="?", icon="pi pi-question", color="#ccc", is_custom=False, type="expense")

        acc_id = data.get("account_id")
        account = account_service.get_account(acc_id)
        if not account:
            account = Account(id="deleted", name="?", type="checking", balance=0, icon="", color="")

        transactions.append(Transaction(
            id=t.id, 
            category=category, 
            account=account, 
            **data
        ))
        
    # Sort by date desc
    transactions.sort(key=lambda x: x.date, reverse=True)
    
    if limit:
        transactions = transactions[:limit]
        
    return transactions

def update_transaction(transaction_id: str, transaction_in: TransactionCreate, user_id: str) -> Transaction:
    db = get_db()
    doc_ref = db.collection(COLLECTION_NAME).document(transaction_id)
    doc = doc_ref.get()
    
    account = account_service.get_account(transaction_in.account_id)
    
    return Transaction(id=transaction_id, category=category, account=account, **data)

def delete_transaction(transaction_id: str, user_id: str):
    db = get_db()
    doc_ref = db.collection(COLLECTION_NAME).document(transaction_id)
    doc = doc_ref.get()
    
    # Verifica Propriedade
    if not doc.exists or doc.to_dict().get('user_id') != user_id:
        raise HTTPException(status_code=404, detail="Transaction not found")
from google.cloud import firestore
from app.core.database import get_db
from app.schemas.transaction import TransactionCreate, Transaction, TransactionStatus
from app.schemas.category import Category 
from app.schemas.account import Account 
from app.core.date_utils import get_month_range
from typing import Optional, List
from datetime import datetime
import uuid
from dateutil.relativedelta import relativedelta

from app.services import category as category_service
from app.services import account as account_service
from app.services import recurrence as recurrence_service
from app.schemas.recurrence import RecurrenceCreate, RecurrencePeriodicity
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
    return Transaction(
        id=transaction_ref.id, 
        category=category, 
        account=account, 
        **data
    )

def create_unified_transaction(transaction_in: TransactionCreate, user_id: str) -> List[Transaction]:
    """
    Cria transações unificadas: Simples, Parceladas ou Recorrentes.
    Retorna uma lista de transações criadas (pode ser 1 ou várias).
    """
    created_transactions = []
    
    # Lógica de Parcelamento (Cenário A)
    if transaction_in.total_installments and transaction_in.total_installments > 1:
        group_id = str(uuid.uuid4())
        recurrence_data = RecurrenceCreate(
            name=transaction_in.description,
            amount=transaction_in.amount,
            category_id=transaction_in.category_id,
            account_id=transaction_in.account_id,
            payment_method_id=transaction_in.payment_method.value,
            periodicity=RecurrencePeriodicity(transaction_in.recurrence_periodicity),
            auto_pay=transaction_in.recurrence_auto_pay,
            due_day=transaction_in.date.day,
            active=True
        )
        
        recurrence = recurrence_service.create_recurrence(recurrence_data, user_id)
        
        if transaction_in.recurrence_create_first:
            t_data = transaction_in.model_dump()
            t_data['recurrence_id'] = recurrence.id
            t_create = TransactionCreate(**t_data)
            created_transactions.append(create_transaction(t_create, user_id))
            
        return created_transactions

    # CENÁRIO C: Simples (Default)
    return [create_transaction(transaction_in, user_id)]

def list_transactions(user_id: str, month: Optional[int] = None, year: Optional[int] = None, limit: Optional[int] = None) -> list[Transaction]:
    db = get_db()
    # FILTRO DO USUÁRIO
    query = db.collection(COLLECTION_NAME).where("user_id", "==", user_id)
    all_transactions = query.stream()

    transactions = []
    
    start_date = None
    end_date = None
    if month and year:
        start_date, end_date = get_month_range(month, year)

    for t in all_transactions:
        data = t.to_dict()
        
        # Date Filtering
        if start_date and end_date:
            t_date = data.get("date")
            
            if t_date:
                # If it's a string, try to parse
                if isinstance(t_date, str):
                    try:
                        t_date = datetime.fromisoformat(t_date.replace('Z', '+00:00'))
                    except:
                        pass 
                
                if isinstance(t_date, datetime):
                     # Make naive for comparison if needed
                     if t_date.tzinfo and not start_date.tzinfo:
                          t_date = t_date.replace(tzinfo=None)
                     elif not t_date.tzinfo and start_date.tzinfo:
                          start_date = start_date.replace(tzinfo=None)
                          end_date = end_date.replace(tzinfo=None)
                     
                     if not (start_date <= t_date <= end_date):
                          continue
                else:
                     continue
            else:
                 continue

        cat_id = data.get("category_id")
        category = category_service.get_category(cat_id)
        if not category:
             category = Category(id="deleted", name="?", icon="pi pi-question", color="#ccc", is_custom=False, type="expense")

        acc_id = data.get("account_id")
        account = account_service.get_account(acc_id)
        if not account:
            account = Account(id="deleted", name="?", type="checking", balance=0, icon="", color="")

        transactions.append(Transaction(
            id=t.id, 
            category=category, 
            account=account, 
            **data
        ))
        
    # Sort by date desc
    transactions.sort(key=lambda x: x.date, reverse=True)
    
    if limit:
        transactions = transactions[:limit]
        
    return transactions

def update_transaction(transaction_id: str, transaction_in: TransactionCreate, user_id: str) -> Transaction:
    db = get_db()
    doc_ref = db.collection(COLLECTION_NAME).document(transaction_id)
    doc = doc_ref.get()
    
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

    status = data.get("status", TransactionStatus.PAID)

    # Estorna Saldo APENAS SE ESTAVA PAGO
    if account_id and status == TransactionStatus.PAID:
        _update_account_balance(db, account_id, amount, t_type, user_id, revert=True)

    doc_ref.delete()
    
    return {"status": "success", "message": "Transaction deleted"}