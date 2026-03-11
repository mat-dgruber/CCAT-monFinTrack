from app.core.database import get_db
from app.schemas.budget import BudgetCreate, Budget
from app.schemas.category import Category, CategoryType
from app.services import category as category_service
from app.core.date_utils import get_month_range
from typing import Optional
from fastapi import HTTPException
from datetime import datetime, timezone

COLLECTION_NAME = "budgets"

def create_budget(budget_in: BudgetCreate, user_id: str) -> Budget:
    db = get_db()
    
    cat = category_service.get_category(budget_in.category_id, user_id)
    
    # Validar Duplicidade

    # Validar Tipo de Categoria
    if cat.type != CategoryType.EXPENSE:
        raise HTTPException(status_code=400, detail="Budgets can only be created for expense categories")
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
    
    # 2. Pegar todas as transações DO USUÁRIO e filtrar em memória para manter compatibilidade com testes e evitar problemas de índice
    transactions_query = (
        db.collection("transactions")
        .where("user_id", "==", user_id)
    )

    try:
        all_transactions = transactions_query.stream()
        filtered_transactions = list(all_transactions)
    except Exception as e:
        # Fallback for missing index or other query errors
        # If it's the specific index error (status 400), we fallback to a simpler query
        # and filter by type manually.
        from app.core.logger import get_logger
        logger = get_logger(__name__)
        logger.warning(f"Optimized budget query failed (likely missing index): {e}. Falling back to memory filtering.")

        # Simple query: just user_id
        fallback_query = db.collection("transactions").where("user_id", "==", user_id)
        all_txs_stream = fallback_query.stream()

        filtered_transactions = []
        for doc in all_txs_stream:
            t_data = doc.to_dict()
            t_type = t_data.get("type")
            t_date = t_data.get("date")

            # Filter by type
            if t_type != "expense":
                continue

            # Filter by date if range is provided
            if month and year:
                start_date, end_date = get_month_range(month, year)
                if not t_date:
                    continue
                # Normalize t_date
                if isinstance(t_date, str):
                    try:
                        t_date = datetime.fromisoformat(t_date.replace("Z", "+00:00"))
                    except Exception:
                        continue

                if t_date.tzinfo is None:
                    t_date = t_date.replace(tzinfo=timezone.utc)

                if not (start_date <= t_date <= end_date):
                    continue

            # If we reach here, it's a match. We only need the stream-compatible doc-like objects
            # but since we are already evaluating, we can just store the data or the doc itself.
            # To maintain compatibility with the rest of the code that calls doc.to_dict():
            filtered_transactions.append(doc)
        
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
            # Create Category object for compatibility with tests and frontend expectations
            cat_obj = Category(
                id=cat_id,
                name=cat_data.get("name", "Unknown"),
                icon=cat_data.get("icon", "pi pi-circle"),
                color=cat_data.get("color", "#000000"),
                type=cat_data.get("type", "expense"),
                user_id=cat_data.get("user_id", user_id),
                is_custom=cat_data.get("is_custom", True)
            )

        # CÁLCULO DE GASTO AGREGADO (Meta da Categoria + Subcategorias)
        target_ids = get_descendants(cat_id)
        spent = sum(spending_map.get(cid, 0.0) for cid in target_ids)
        
        limit = data.get("amount", 0.0)
        percentage = (spent / limit) * 100 if limit > 0 else 0
        
        budgets.append({
            "id": doc.id,
            "user_id": user_id, # REQUIRED by Budget Schema
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
        raise HTTPException(status_code=404, detail="Budget not found or access denied")
    
    cat = category_service.get_category(budget_in.category_id, user_id)
    
    # Validate Category Type
    if cat.type != CategoryType.EXPENSE:
        raise Exception("Budgets can only be created for expense categories")
        
    data = budget_in.model_dump()
    data['user_id'] = user_id
    
    doc_ref.update(data)
    return Budget(id=budget_id, category=cat, **data)

def delete_budget(budget_id: str, user_id: str):
    db = get_db()
    doc_ref = db.collection(COLLECTION_NAME).document(budget_id)
    doc = doc_ref.get()
    
    if not doc.exists or doc.to_dict().get('user_id') != user_id:
        raise HTTPException(status_code=404, detail="Budget not found")

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