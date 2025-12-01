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
    
    # Atualiza Saldo (Passando user_id para segurança) - APENAS SE PAGO
    if transaction_in.status == TransactionStatus.PAID:
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
            # Se for a primeira parcela, o status é o que veio no form. Se não, PENDING.
            if transaction_in.installment_number is None or transaction_in.installment_number == 1:
                 pass # Usa o status do form
            else:
                 t_data['status'] = TransactionStatus.PENDING

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
    
    # Verifica Propriedade
    if not doc.exists or doc.to_dict().get('user_id') != user_id:
        raise HTTPException(status_code=404, detail="Transaction not found")
        
    old_data = doc.to_dict()
    
    old_status = old_data.get("status", TransactionStatus.PAID)
    
    # Estorna valor antigo APENAS SE ESTAVA PAGO
    if old_status == TransactionStatus.PAID:
        _update_account_balance(
            db, old_data.get("account_id"), old_data.get("amount", 0), old_data.get("type"), user_id, revert=True
        )

    # Aplica novo valor APENAS SE NOVO STATUS É PAGO
    if transaction_in.status == TransactionStatus.PAID:
        _update_account_balance(
            db, transaction_in.account_id, transaction_in.amount, transaction_in.type, user_id, revert=False
        )
    
    data = transaction_in.model_dump()
    data['user_id'] = user_id
    doc_ref.set(data)
    

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
    
    # Atualiza Saldo (Passando user_id para segurança) - APENAS SE PAGO
    if transaction_in.status == TransactionStatus.PAID:
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
            # Se for a primeira parcela, o status é o que veio no form. Se não, PENDING.
            if transaction_in.installment_number is None or transaction_in.installment_number == 1:
                 pass # Usa o status do form
            else:
                 t_data['status'] = TransactionStatus.PENDING

            t_create = TransactionCreate(**t_data)
            created_transactions.append(create_transaction(t_create, user_id))
            
        return created_transactions

    # CENÁRIO C: Simples (Default)
    return [create_transaction(transaction_in, user_id)]

def list_transactions(user_id: str, month: Optional[int] = None, year: Optional[int] = None, limit: Optional[int] = None, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None) -> list[Transaction]:
    db = get_db()
    # FILTRO DO USUÁRIO
    query = db.collection(COLLECTION_NAME).where("user_id", "==", user_id)
    all_transactions = query.stream()

    transactions = []
    
    # Se não vieram datas específicas, mas veio mês/ano, calcula o range
    if not start_date and not end_date and month and year:
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
    
    # Verifica Propriedade
    if not doc.exists or doc.to_dict().get('user_id') != user_id:
        raise HTTPException(status_code=404, detail="Transaction not found")
        
    old_data = doc.to_dict()
    
    old_status = old_data.get("status", TransactionStatus.PAID)
    
    # Estorna valor antigo APENAS SE ESTAVA PAGO
    if old_status == TransactionStatus.PAID:
        _update_account_balance(
            db, old_data.get("account_id"), old_data.get("amount", 0), old_data.get("type"), user_id, revert=True
        )

    # Aplica novo valor APENAS SE NOVO STATUS É PAGO
    if transaction_in.status == TransactionStatus.PAID:
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
    installment_group_id = data.get("installment_group_id")

    # Lógica de Exclusão em Grupo (Se for parcelado)
    if installment_group_id:
        # Busca todas as parcelas do grupo
        group_query = db.collection(COLLECTION_NAME)\
            .where("user_id", "==", user_id)\
            .where("installment_group_id", "==", installment_group_id)\
            .stream()
            
        deleted_count = 0
        for t in group_query:
            t_data = t.to_dict()
            t_id = t.id
            t_amount = t_data.get("amount", 0)
            t_type = t_data.get("type")
            t_account_id = t_data.get("account_id")
            t_status = t_data.get("status", TransactionStatus.PAID)
            
            # Estorna Saldo APENAS SE ESTAVA PAGO
            if t_account_id and t_status == TransactionStatus.PAID:
                _update_account_balance(db, t_account_id, t_amount, t_type, user_id, revert=True)
            
            db.collection(COLLECTION_NAME).document(t_id).delete()
            deleted_count += 1
            
        return {"status": "success", "message": f"Deleted {deleted_count} transactions from group"}

    # Lógica Simples (Não é parcelado)
    amount = data.get("amount", 0)
    t_type = data.get("type")
    account_id = data.get("account_id")
    status = data.get("status", TransactionStatus.PAID)

    # Estorna Saldo APENAS SE ESTAVA PAGO
    if account_id and status == TransactionStatus.PAID:
        _update_account_balance(db, account_id, amount, t_type, user_id, revert=True)

    doc_ref.delete()
    
    return {"status": "success", "message": "Transaction deleted"}

def get_upcoming_transactions(user_id: str, limit: int = 10) -> List[Transaction]:
    db = get_db()
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Query: user_id == user AND status == pending AND date >= today
    # Firestore requires composite index for this. 
    # Simpler approach: Query pending transactions, filter by date in python if dataset is small, 
    # OR query by date >= today and filter status.
    # Given we want "upcoming", date is the most important sort.
    
    query = db.collection(COLLECTION_NAME)\
        .where("user_id", "==", user_id)\
        .where("status", "==", TransactionStatus.PENDING)\
        .where("date", ">=", today)\
        .order_by("date", direction=firestore.Query.ASCENDING)\
        .limit(limit)
        
    docs = query.stream()
    
    transactions = []
    for t in docs:
        data = t.to_dict()
        
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
        
    return transactions
