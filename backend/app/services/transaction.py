from google.cloud import firestore
from app.core.database import get_db
from app.schemas.transaction import TransactionCreate, Transaction, TransactionStatus, TransactionType
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
from app.services.analysis_service import analysis_service 
from app.schemas.recurrence import RecurrenceCreate, RecurrencePeriodicity
from fastapi import HTTPException

COLLECTION_NAME = "transactions"

# Função Auxiliar Blindada
def _update_account_balance(db, account_id: str, amount: float, type: str, user_id: str, revert: bool = False, destination_account_id: str = None):
    if not account_id:
        return

    # SOURCE ACCOUNT
    acc_ref = db.collection("accounts").document(account_id)
    acc_doc = acc_ref.get()
    
    if acc_doc.exists and acc_doc.to_dict().get('user_id') == user_id:
        current_balance = acc_doc.to_dict().get("balance", 0.0)
        
        # LOGIC FOR SOURCE ACCOUNT
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
        elif type == "transfer":
            # Transfers always decrement source, unless reverting
            if revert:
                current_balance += amount
            else:
                current_balance -= amount

        acc_ref.update({"balance": current_balance})
    else:
        print(f"⚠️ Acesso negado ou conta inexistente para update de saldo. User: {user_id}, Acc: {account_id}")

    # DESTINATION ACCOUNT (Only for Transfers with explicit destination)
    if type == "transfer" and destination_account_id:
        dest_ref = db.collection("accounts").document(destination_account_id)
        dest_doc = dest_ref.get()
        
        if dest_doc.exists and dest_doc.to_dict().get('user_id') == user_id:
            dest_balance = dest_doc.to_dict().get("balance", 0.0)
            
            if revert:
                dest_balance -= amount # Reverting transfer: Remove from dest
            else:
                dest_balance += amount # Applying transfer: Add to dest
                
            dest_ref.update({"balance": dest_balance})
        else:
            print(f"⚠️ Acesso negado ou conta destino inexistente. User: {user_id}, DestAcc: {destination_account_id}")

def create_transaction(transaction_in: TransactionCreate, user_id: str) -> Transaction:
    db = get_db()
    
    category = category_service.get_category(transaction_in.category_id)
    # Aqui também seria ideal verificar se a categoria é do usuário
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    account = account_service.get_account(transaction_in.account_id)
    
    destination_account = None
    if transaction_in.destination_account_id:
         destination_account = account_service.get_account(transaction_in.destination_account_id)

    # Atualiza Saldo (Passando user_id para segurança) - APENAS SE PAGO E NÃO FOR CARTÃO DE CRÉDITO
    if transaction_in.status == TransactionStatus.PAID and not transaction_in.credit_card_id:
        _update_account_balance(
            db, 
            transaction_in.account_id, 
            transaction_in.amount, 
            transaction_in.type, 
            user_id, 
            revert=False,
            destination_account_id=transaction_in.destination_account_id 
        )
    
    # --- ANOMALY DETECTION (PRO) ---
    if transaction_in.type == TransactionType.EXPENSE and not transaction_in.warning:
        warning = analysis_service.analyze_transaction(user_id, transaction_in.amount, transaction_in.category_id)
        if warning:
            transaction_in.warning = warning
    # -------------------------------

    data = transaction_in.model_dump()
    data['user_id'] = user_id # MARCA DONO
    
    update_time, transaction_ref = db.collection(COLLECTION_NAME).add(data)
    
    return Transaction(
        id=transaction_ref.id, 
        category=category, 
        account=account, 
        destination_account=destination_account,
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
        
        base_date = transaction_in.date
        # Ensure base_date is datetime
        if not isinstance(base_date, datetime):
             base_date = datetime.combine(base_date, datetime.min.time())

        for i in range(transaction_in.total_installments):
            # Calculate due date: base_date + i months
            due_date = base_date + relativedelta(months=i)
            
            # Prepare data
            t_data = transaction_in.model_dump()
            t_data['installment_group_id'] = group_id
            t_data['installment_number'] = i + 1
            t_data['date'] = due_date
            
            # Divide amount? No, usually user enters the installment value or total value?
            # In this app context (monFinTrack), the form seems to send the 'amount' as the INSTALLMENT value (based on UI context usually)
            # OR checking the form: "Valor" input. Usually in these apps it's the value of the transaction.
            # If the user enters 1000 and 10x, is it 10x 100 or 10x 1000?
            # Let's assume the input IS the installment value (standard in many personal finance apps, or user calculates).
            # Looking at the code: `amount=transaction_in.amount` was passed to Recurrence. Recurrence used that amount. 
            # So the input amount IS the installment amount.
            
            # Status Logic
            # 1st installment: Respeita o que veio do form (ex: Pago)
            # Others: Always PENDING
            if i == 0:
                 # Respeita o status que veio (pode ser PAID se usuario marcou "Pago")
                 pass
            else:
                 t_data['status'] = TransactionStatus.PENDING
                 t_data['is_paid'] = False
                 t_data['payment_date'] = None
                 # Reset Tithe/Offering status for future installments?
                 # Probably yes, they haven't happened yet.
                 if 'tithe_status' in t_data:
                      t_data['tithe_status'] = 'PENDING' if t_data.get('tithe_status') != 'NONE' else 'NONE'
            
            # Description: "Title (1/10)"
            original_title = transaction_in.title
            t_data['description'] = f"{original_title} ({i+1}/{transaction_in.total_installments})"
            # Also keep title clean? Or update title?
            # Transaction schema has title. Let's update title.
            # t_data['title'] = original_title # Keep main title clean? 
            # The 'description' field is often used for details.
            # But in the previous recurrence logic, description was set to "Name (MM/YYYY)".
            # Let's append (x/y) to title to make it clear in lists that show title.
            t_data['title'] = f"{original_title} ({i+1}/{transaction_in.total_installments})"

            t_create = TransactionCreate(**t_data)
            created_transactions.append(create_transaction(t_create, user_id))
            
        return created_transactions

    # CENÁRIO B: Recorrência (Sem parcelas)
    if transaction_in.recurrence_periodicity:
        recurrence_data = RecurrenceCreate(
            name=transaction_in.title,
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
            
            # Lógica de Auto-Pay para a primeira transação
            # Se auto-pay estiver ativo, e a data for futura, deve nascer PENDENTE.
            # Se for hoje ou passado, respeita o status do form (provavelmente PAGO se o user marcou).
            if transaction_in.recurrence_auto_pay:
                today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
                t_date = transaction_in.date
                if t_date.tzinfo:
                    t_date = t_date.replace(tzinfo=None)
                t_date = t_date.replace(hour=0, minute=0, second=0, microsecond=0)
                
                if t_date > today:
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
             category = Category(id="deleted", name="Deleted", icon="pi pi-question", color="#ccc", is_custom=False, type="expense")

        acc_id = data.get("account_id")
        account = account_service.get_account(acc_id)
        if not account:
            account = Account(id="deleted", name="Deleted", type="checking", balance=0, icon="", color="")

        # Helper to get destination account if exists
        dest_acc_id = data.get("destination_account_id")
        destination_account = None
        if dest_acc_id:
             destination_account = account_service.get_account(dest_acc_id)

        transactions.append(Transaction(
            id=t.id, 
            category=category, 
            account=account,
            destination_account=destination_account, 
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
    
    start_balance_update = False
    
    # Estorna valor antigo APENAS SE ESTAVA PAGO E NÃO ERA CARTÃO
    if old_status == TransactionStatus.PAID and not old_data.get("credit_card_id"):
        _update_account_balance(
            db, 
            old_data.get("account_id"), 
            old_data.get("amount", 0), 
            old_data.get("type"), 
            user_id, 
            revert=True,
            destination_account_id=old_data.get("destination_account_id")
        )

    # Aplica novo valor APENAS SE NOVO STATUS É PAGO E NÃO É CARTÃO
    if transaction_in.status == TransactionStatus.PAID and not transaction_in.credit_card_id:
        _update_account_balance(
            db, 
            transaction_in.account_id, 
            transaction_in.amount, 
            transaction_in.type, 
            user_id, 
            revert=False,
            destination_account_id=transaction_in.destination_account_id
        )
    
    data = transaction_in.model_dump()
    data['user_id'] = user_id
    doc_ref.set(data)
    
    category = category_service.get_category(transaction_in.category_id)
    account = account_service.get_account(transaction_in.account_id)
    
    dest_acc_id = data.get("destination_account_id")
    destination_account = None
    if dest_acc_id:
         destination_account = account_service.get_account(dest_acc_id)

    return Transaction(id=transaction_id, category=category, account=account, destination_account=destination_account, **data)

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
            
            # Estorna Saldo APENAS SE ESTAVA PAGO E NÃO ERA CARTÃO
            t_credit_card_id = t_data.get("credit_card_id")
            if t_account_id and t_status == TransactionStatus.PAID and not t_credit_card_id:
                _update_account_balance(
                     db, 
                     t_account_id, 
                     t_amount, 
                     t_type, 
                     user_id, 
                     revert=True,
                     destination_account_id=t_data.get("destination_account_id")
                )
            
            db.collection(COLLECTION_NAME).document(t_id).delete()
            deleted_count += 1
            
        return {"status": "success", "message": f"Deleted {deleted_count} transactions from group"}

    # Lógica Simples (Não é parcelado)
    amount = data.get("amount", 0)
    t_type = data.get("type")
    account_id = data.get("account_id")
    status = data.get("status", TransactionStatus.PAID)
    credit_card_id = data.get("credit_card_id")

    # Estorna Saldo APENAS SE ESTAVA PAGO E NÃO ERA CARTÃO
    if account_id and status == TransactionStatus.PAID and not credit_card_id:
        _update_account_balance(
             db, 
             account_id, 
             amount, 
             t_type, 
             user_id, 
             revert=True,
             destination_account_id=data.get("destination_account_id")
        )

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

        if 'title' not in data and 'description' in data:
             data['title'] = data.pop('description')
             data['description'] = None

        # Helper to get destination account if exists
        dest_acc_id = data.get("destination_account_id")
        destination_account = None
        if dest_acc_id:
             destination_account = account_service.get_account(dest_acc_id)

        transactions.append(Transaction(
            id=t.id, 
            category=category, 
            account=account, 
            destination_account=destination_account,
            **data
        ))
        
    return transactions

def delete_all_transactions(user_id: str):
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

def get_first_transaction_date(user_id: str) -> Optional[datetime]:
    """
    Returns the date of the very first transaction for the user.
    Used for calculating averages for new users (adaptive timeframe).
    """
    db = get_db()
    
    # Query for the oldest transaction
    query = db.collection(COLLECTION_NAME)\
        .where("user_id", "==", user_id)\
        .order_by("date", direction=firestore.Query.ASCENDING)\
        .limit(1)
        
    docs = list(query.stream())
    
    if not docs:
        return None
        
    data = docs[0].to_dict()
    first_date = data.get("date")
    
    # Ensure it's a datetime
    if isinstance(first_date, str):
        try:
            first_date = datetime.fromisoformat(first_date.replace('Z', '+00:00'))
        except:
            return None
            
    if isinstance(first_date, datetime):
        # Convert to naive if needed or keep timezone? 
        # Usually internal logic prefers naive UTC or consistent timezone.
        # Let's return as is, caller handles logic.
        return first_date
        
    return None

