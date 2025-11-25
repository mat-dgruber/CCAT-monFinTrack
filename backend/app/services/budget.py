from app.core.database import get_db
from app.schemas.budget import BudgetCreate, Budget
from app.services import category as category_service

from fastapi import HTTPException

COLLECTION_NAME = "budgets"

def create_budget(budget_in: BudgetCreate) -> Budget:
    db = get_db()
    
    # Verifica se a categoria existe
    cat = category_service.get_category(budget_in.category_id)
    if not cat:
        # Em app real, levantar erro 404
        pass

    data = budget_in.model_dump()
    update_time, doc_ref = db.collection(COLLECTION_NAME).add(data)
    
    return Budget(id=doc_ref.id, category=cat, **data)

def list_budgets_with_progress() -> list[dict]:
    """
    Lista as metas e calcula quanto já foi gasto nelas (Lógica simples: soma total)
    Nota: Em um SaaS real, filtraríamos por Mês/Ano aqui.
    """
    db = get_db()
    
    # 1. Pegar todas as metas
    budget_docs = db.collection(COLLECTION_NAME).stream()
    budgets = []
    
    # 2. Pegar todas as despesas (O ideal seria filtrar no banco, mas faremos em memória agora)
    transactions = db.collection("transactions").where("type", "==", "expense").stream()
    spending_map = {} # { "category_id": total_gasto }
    
    for t in transactions:
        data = t.to_dict()
        cat_id = data.get("category_id")
        amount = data.get("amount", 0)
        
        if cat_id in spending_map:
            spending_map[cat_id] += amount
        else:
            spending_map[cat_id] = amount

    # 3. Montar a resposta combinada
    for doc in budget_docs:
        data = doc.to_dict()
        cat_id = data.get("category_id")
        
        # Busca info da categoria (nome, cor, icone)
        cat_obj = category_service.get_category(cat_id)
        
        # Quanto gastei nessa categoria?
        spent = spending_map.get(cat_id, 0.0)
        limit = data.get("amount", 0.0)
        
        # Calcula porcentagem
        percentage = (spent / limit) * 100 if limit > 0 else 0
        
        budgets.append({
            "id": doc.id,
            "category": cat_obj, # Objeto Pydantic ou Dict
            "limit": limit,
            "spent": spent,
            "percentage": min(percentage, 100), # Trava em 100% visualmente
            "is_over_budget": spent > limit
        })
        
    return budgets


def update_budget(budget_id: str, budget_in: BudgetCreate) -> Budget:
    db = get_db()
    doc_ref = db.collection(COLLECTION_NAME).document(budget_id)
    
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Budget not found")
    
    # Verifica se a nova categoria existe (opcional, mas bom)
    cat = category_service.get_category(budget_in.category_id)
    
    data = budget_in.model_dump()
    doc_ref.update(data)
    
    return Budget(id=budget_id, category=cat, **data)

    

def delete_budget(budget_id: str):
    db = get_db()
    db.collection(COLLECTION_NAME).document(budget_id).delete()
    return {"status": "success"}