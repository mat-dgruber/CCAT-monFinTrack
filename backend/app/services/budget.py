from app.core.database import get_db
from app.schemas.budget import BudgetCreate, Budget
from app.schemas.category import CategoryType
from app.services import category as category_service
from app.core.date_utils import get_month_range
from typing import Optional
from fastapi import HTTPException

COLLECTION_NAME = "budgets"

def create_budget(budget_in: BudgetCreate, user_id: str) -> Budget:
    db = get_db()
    
    cat = category_service.get_category(budget_in.category_id)
    
    # Validate Category Type
    if cat.type != CategoryType.EXPENSE:
        raise HTTPException(status_code=400, detail="Budgets can only be created for expense categories")

    # Em produção, verificaríamos se a categoria pertence ao user_id aqui também

    data = budget_in.model_dump()
    data['user_id'] = user_id
    
    update_time, doc_ref = db.collection(COLLECTION_NAME).add(data)
    return Budget(id=doc_ref.id, category=cat, **data)

def list_budgets(user_id: str) -> list[dict]:
    db = get_db()
    budget_docs = db.collection(COLLECTION_NAME).where("user_id", "==", user_id).stream()
    return [{**doc.to_dict(), "id": doc.id} for doc in budget_docs]

def list_budgets_with_progress(user_id: str, month: Optional[int] = None, year: Optional[int] = None) -> list[dict]:
    db = get_db()
    
    # 0. Buscar todas as categorias para montar mapa de hierarquia
    cat_docs = db.collection("categories").where("user_id", "==", user_id).stream()
    # Mapa: parent_id -> [child_id, child_id, ...]
    children_map = {}
    all_categories_map = {} # id -> obj
    
    for doc in cat_docs:
        d = doc.to_dict()
        cid = doc.id
        all_categories_map[cid] = d
        pid = d.get("parent_id")
        
        if pid:
            if pid not in children_map:
                children_map[pid] = []
            children_map[pid].append(cid)

    def get_descendants(root_id):
        """Retorna lista contendo root_id e todos os IDs dos descendentes (recursivo)"""
        result = [root_id]
        stack = [root_id]
        while stack:
            curr = stack.pop()
            children = children_map.get(curr, [])
            for child in children:
                result.append(child)
                stack.append(child)
        return result

    # 1. Pegar metas DO USUÁRIO
    budget_docs = db.collection(COLLECTION_NAME).where("user_id", "==", user_id).stream()
    budgets = []
    
    # 2. Pegar despesas DO USUÁRIO
    transactions_query = db.collection("transactions").where("user_id", "==", user_id)
    all_transactions = transactions_query.stream()

    filtered_transactions = []
    if month and year:
        start_date, end_date = get_month_range(month, year)
        for t in all_transactions:
            t_data = t.to_dict()
            transaction_date = t_data.get("date")
            
            # Verificar se a data é naive e converter se necessário (hack de segurança)
            if transaction_date and transaction_date.tzinfo is None:
                 from datetime import timezone
                 transaction_date = transaction_date.replace(tzinfo=timezone.utc)

            if t_data.get("type") == "expense" and transaction_date and start_date <= transaction_date <= end_date:
                filtered_transactions.append(t)
    else:
        for t in all_transactions:
            if t.to_dict().get("type") == "expense":
                filtered_transactions.append(t)
        
    spending_map = {} 
    
    for t in filtered_transactions:
        data = t.to_dict()
        cat_id = data.get("category_id")
        amount = data.get("amount", 0)
        
        if cat_id in spending_map:
            spending_map[cat_id] += amount
        else:
            spending_map[cat_id] = amount

    for doc in budget_docs:
        data = doc.to_dict()
        cat_id = data.get("category_id")
        
        # cat_obj = category_service.get_category(cat_id) # Evitar N queries
        # Usar mapa carregado previamente
        cat_data = all_categories_map.get(cat_id)
        # Recriar objeto Category básico se necessário ou passar dict. O frontend espera objeto com nome.
        # O `get_category` retorna um objeto Pydantic. Vamos manter simples por enquanto.
        # Mas para compatibilidade, ideal é chamar o service ou simular o objeto.
        # Como estamos retornando dict aqui, podemos apenas passar o dict da categoria.
        
        # Se o frontend espera 'name', 'color', etc.
        cat_obj = None
        if cat_data:
            # Mocking minimal structure expected by frontend
            cat_obj = cat_data
            cat_obj['id'] = cat_id

        # CÁLCULO DE GASTO AGREGADO (Meta da Categoria + Subcategorias)
        target_ids = get_descendants(cat_id)
        spent = sum(spending_map.get(cid, 0.0) for cid in target_ids)
        
        limit = data.get("amount", 0.0)
        percentage = (spent / limit) * 100 if limit > 0 else 0
        
        budgets.append({
            "id": doc.id,
            "category_id": cat_id,
            "category": cat_obj, # Pydantic model expects obj, but dict works if schema allows or if we cast.
            "amount": limit,
            "spent": spent,
            "percentage": min(percentage, 100),
            "is_over_budget": spent > limit
        })
        
    return budgets

def update_budget(budget_id: str, budget_in: BudgetCreate, user_id: str) -> Budget:
    db = get_db()
    doc_ref = db.collection(COLLECTION_NAME).document(budget_id)
    doc = doc_ref.get()
    
    if not doc.exists or doc.to_dict().get('user_id') != user_id:
        # Retornamos erro ou None, aqui vou levantar erro genérico para simplificar
        raise Exception("Budget not found or access denied")
    
    cat = category_service.get_category(budget_in.category_id)
    
    # Validate Category Type
    if cat.type != CategoryType.EXPENSE:
        raise HTTPException(status_code=400, detail="Budgets can only be created for expense categories")
        
    data = budget_in.model_dump()
    data['user_id'] = user_id
    
    doc_ref.update(data)
    return Budget(id=budget_id, category=cat, **data)

def delete_budget(budget_id: str, user_id: str):
    db = get_db()
from app.core.database import get_db
from app.schemas.budget import BudgetCreate, Budget
from app.schemas.category import CategoryType
from app.services import category as category_service
from app.core.date_utils import get_month_range
from typing import Optional
from fastapi import HTTPException

COLLECTION_NAME = "budgets"

def create_budget(budget_in: BudgetCreate, user_id: str) -> Budget:
    db = get_db()
    
    cat = category_service.get_category(budget_in.category_id)
    
    # Validate Category Type
    if cat.type != CategoryType.EXPENSE:
        raise HTTPException(status_code=400, detail="Budgets can only be created for expense categories")

    # Em produção, verificaríamos se a categoria pertence ao user_id aqui também

    data = budget_in.model_dump()
    data['user_id'] = user_id
    
    update_time, doc_ref = db.collection(COLLECTION_NAME).add(data)
    return Budget(id=doc_ref.id, category=cat, **data)

def list_budgets(user_id: str) -> list[dict]:
    db = get_db()
    budget_docs = db.collection(COLLECTION_NAME).where("user_id", "==", user_id).stream()
    return [{**doc.to_dict(), "id": doc.id} for doc in budget_docs]

def list_budgets_with_progress(user_id: str, month: Optional[int] = None, year: Optional[int] = None) -> list[dict]:
    db = get_db()
    
    # 0. Buscar todas as categorias para montar mapa de hierarquia
    cat_docs = db.collection("categories").where("user_id", "==", user_id).stream()
    # Mapa: parent_id -> [child_id, child_id, ...]
    children_map = {}
    all_categories_map = {} # id -> obj
    
    for doc in cat_docs:
        d = doc.to_dict()
        cid = doc.id
        all_categories_map[cid] = d
        pid = d.get("parent_id")
        
        if pid:
            if pid not in children_map:
                children_map[pid] = []
            children_map[pid].append(cid)

    def get_descendants(root_id):
        """Retorna lista contendo root_id e todos os IDs dos descendentes (recursivo)"""
        result = [root_id]
        stack = [root_id]
        while stack:
            curr = stack.pop()
            children = children_map.get(curr, [])
            for child in children:
                result.append(child)
                stack.append(child)
        return result

    # 1. Pegar metas DO USUÁRIO
    budget_docs = db.collection(COLLECTION_NAME).where("user_id", "==", user_id).stream()
    budgets = []
    
    # 2. Pegar despesas DO USUÁRIO
    transactions_query = db.collection("transactions").where("user_id", "==", user_id)
    all_transactions = transactions_query.stream()

    filtered_transactions = []
    if month and year:
        start_date, end_date = get_month_range(month, year)
        for t in all_transactions:
            t_data = t.to_dict()
            transaction_date = t_data.get("date")
            
            # Verificar se a data é naive e converter se necessário (hack de segurança)
            if transaction_date and transaction_date.tzinfo is None:
                 from datetime import timezone
                 transaction_date = transaction_date.replace(tzinfo=timezone.utc)

            if t_data.get("type") == "expense" and transaction_date and start_date <= transaction_date <= end_date:
                filtered_transactions.append(t)
    else:
        for t in all_transactions:
            if t.to_dict().get("type") == "expense":
                filtered_transactions.append(t)
        
    spending_map = {} 
    
    for t in filtered_transactions:
        data = t.to_dict()
        cat_id = data.get("category_id")
        amount = data.get("amount", 0)
        
        if cat_id in spending_map:
            spending_map[cat_id] += amount
        else:
            spending_map[cat_id] = amount

    for doc in budget_docs:
        data = doc.to_dict()
        cat_id = data.get("category_id")
        
        # cat_obj = category_service.get_category(cat_id) # Evitar N queries
        # Usar mapa carregado previamente
        cat_data = all_categories_map.get(cat_id)
        # Recriar objeto Category básico se necessário ou passar dict. O frontend espera objeto com nome.
        # O `get_category` retorna um objeto Pydantic. Vamos manter simples por enquanto.
        # Mas para compatibilidade, ideal é chamar o service ou simular o objeto.
        # Como estamos retornando dict aqui, podemos apenas passar o dict da categoria.
        
        # Se o frontend espera 'name', 'color', etc.
        cat_obj = None
        if cat_data:
            # Mocking minimal structure expected by frontend
            cat_obj = cat_data
            cat_obj['id'] = cat_id

        # CÁLCULO DE GASTO AGREGADO (Meta da Categoria + Subcategorias)
        target_ids = get_descendants(cat_id)
        spent = sum(spending_map.get(cid, 0.0) for cid in target_ids)
        
        limit = data.get("amount", 0.0)
        percentage = (spent / limit) * 100 if limit > 0 else 0
        
        budgets.append({
            "id": doc.id,
            "category_id": cat_id,
            "category": cat_obj, # Pydantic model expects obj, but dict works if schema allows or if we cast.
            "amount": limit,
            "spent": spent,
            "percentage": min(percentage, 100),
            "is_over_budget": spent > limit
        })
        
    return budgets

def update_budget(budget_id: str, budget_in: BudgetCreate, user_id: str) -> Budget:
    db = get_db()
    doc_ref = db.collection(COLLECTION_NAME).document(budget_id)
    doc = doc_ref.get()
    
    if not doc.exists or doc.to_dict().get('user_id') != user_id:
        # Retornamos erro ou None, aqui vou levantar erro genérico para simplificar
        raise Exception("Budget not found or access denied")
    
    cat = category_service.get_category(budget_in.category_id)
    
    # Validate Category Type
    if cat.type != CategoryType.EXPENSE:
        raise HTTPException(status_code=400, detail="Budgets can only be created for expense categories")
        
    data = budget_in.model_dump()
    data['user_id'] = user_id
    
    doc_ref.update(data)
    return Budget(id=budget_id, category=cat, **data)

def delete_budget(budget_id: str, user_id: str):
    db = get_db()
    doc_ref = db.collection(COLLECTION_NAME).document(budget_id)
    doc = doc_ref.get()
    
    if not doc.exists or doc.to_dict().get('user_id') != user_id:
        raise Exception("Budget not found")

    doc_ref.delete()
    return {"status": "success"}

def delete_all_budgets(user_id: str):
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