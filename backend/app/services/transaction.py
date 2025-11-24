from app.core.database import get_db
from app.schemas.transaction import TransactionCreate, Transaction
from app.schemas.category import Category 
from app.schemas.account import Account 
from app.schemas.transaction import TransactionType

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
    account_ref = db.collection("accounts").document(transaction_in.account_id)
    account_snap = account_ref.get()
    
    if not account_snap.exists:
        raise HTTPException(status_code=404, detail="Account not found")
        
    account_data = account_snap.to_dict()
    current_balance = account_data.get("balance", 0.0)

    # 3. Lógica Matemática do Saldo 🧮
    new_balance = current_balance
    
    if transaction_in.type == TransactionType.EXPENSE:
        new_balance -= transaction_in.amount
    elif transaction_in.type == TransactionType.INCOME:
        new_balance += transaction_in.amount
        
    # 4. Atualiza o Saldo no Banco
    account_ref.update({"balance": new_balance})
    
    # 5. Salva a Transação
    data = transaction_in.model_dump()
    update_time, transaction_ref = db.collection(COLLECTION_NAME).add(data)
    
    # 6. Prepara o objeto Conta atualizado para retornar
    # (Assim o front já recebe o saldo novo se precisar)
    account_obj = Account(id=account_ref.id, **account_data)
    account_obj.balance = new_balance # Atualizamos o objeto em memória
    
    return Transaction(
        id=transaction_ref.id, 
        category=category, 
        account=account_obj, 
        **data
    )


def delete_transaction(transaction_id: str):
    db = get_db()
    
    # 1. Buscar a transação
    doc_ref = db.collection(COLLECTION_NAME).document(transaction_id)
    doc = doc_ref.get()
    
    if not doc.exists:
        # Se não existe, retorna erro, mas um 404 limpo
        raise HTTPException(status_code=404, detail="Transaction not found")
        
    data = doc.to_dict()
    
    # 2. Extração segura dos dados (usando .get para não quebrar se faltar)
    amount = data.get("amount", 0)
    t_type = data.get("type")
    account_id = data.get("account_id") # Pode vir None em transações antigas

    # 3. Lógica de Estorno (SÓ SE tiver account_id válido)
    if account_id:
        acc_ref = db.collection("accounts").document(account_id)
        acc_doc = acc_ref.get()
        
        # Só atualiza se a conta ainda existir
        if acc_doc.exists:
            current_balance = acc_doc.to_dict().get("balance", 0.0)
            new_balance = current_balance
            
            # Inverte a lógica:
            # Se era despesa, devolve (+). Se era receita, tira (-).
            if t_type == "expense":
                new_balance += amount
            elif t_type == "income":
                new_balance -= amount
            
            # Atualiza saldo
            acc_ref.update({"balance": new_balance})
        else:
            print(f"⚠️ Aviso: Tentativa de estorno em conta inexistente (ID: {account_id})")

    # 4. Deleta a transação de qualquer jeito
    doc_ref.delete()
    
    return {"status": "success", "message": "Transaction deleted"}

# Função auxiliar para não repetirmos matemática
def _update_account_balance(db, account_id: str, amount: float, type: str, revert: bool = False):
    if not account_id:
        return

    acc_ref = db.collection("accounts").document(account_id)
    acc_doc = acc_ref.get()
    
    if acc_doc.exists:
        current_balance = acc_doc.to_dict().get("balance", 0.0)
        
        # Se 'revert' for True, fazemos o oposto (estorno)
        # Se for False, aplicamos a transação normal
        if type == "expense":
            if revert:
                current_balance += amount # Devolve
            else:
                current_balance -= amount # Tira
        elif type == "income":
            if revert:
                current_balance -= amount # Tira
            else:
                current_balance += amount # Coloca
                
        acc_ref.update({"balance": current_balance})


def update_transaction(transaction_id: str, transaction_in: TransactionCreate) -> Transaction:
    db = get_db()
    
    # 1. Buscar a transação ANTIGA (para estornar o valor velho)
    doc_ref = db.collection(COLLECTION_NAME).document(transaction_id)
    doc = doc_ref.get()
    
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Transaction not found")
        
    old_data = doc.to_dict()
    
    # 2. Estornar o impacto da transação antiga na conta antiga
    _update_account_balance(
        db, 
        old_data.get("account_id"), 
        old_data.get("amount", 0), 
        old_data.get("type"), 
        revert=True # <--- IMPORTANTE: Desfaz o passado
    )

    # 3. Aplicar o impacto da NOVA transação na conta (pode ser a mesma ou outra)
    _update_account_balance(
        db, 
        transaction_in.account_id, 
        transaction_in.amount, 
        transaction_in.type, 
        revert=False # <--- Aplica o presente
    )
    
    # 4. Atualizar os dados no documento
    new_data = transaction_in.model_dump()
    doc_ref.set(new_data) # .set sobrescreve tudo
    
    # 5. Buscar objetos completos para retorno (Categoria e Conta)
    category = category_service.get_category(transaction_in.category_id)
    account = account_service.get_account(transaction_in.account_id)
    
    return Transaction(
        id=transaction_id, 
        category=category, 
        account=account, 
        **new_data
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