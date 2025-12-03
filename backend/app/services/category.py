from app.core.database import get_db
from app.schemas.category import CategoryCreate, Category, CategoryType
from fastapi import HTTPException
from typing import Optional, List, Dict, Any

COLLECTION_NAME = "categories"

def create_category(category_in: CategoryCreate, user_id: str) -> Category:
    db = get_db()
    data = category_in.model_dump()
    data['user_id'] = user_id # Marca o dono
    
    update_time, doc_ref = db.collection(COLLECTION_NAME).add(data)
    return Category(id=doc_ref.id, **data)

def list_categories(user_id: str, cat_type: Optional[CategoryType] = None) -> List[Category]:
    db = get_db()
    # Filtra apenas categorias do usuário
    query = db.collection(COLLECTION_NAME).where("user_id", "==", user_id)
    
    if cat_type:
        query = query.where("type", "==", cat_type.value)
        
    docs = query.stream()
    
    all_cats: List[Dict[str, Any]] = []
    for doc in docs:
        data = doc.to_dict()
        data['id'] = doc.id
        data['subcategories'] = []
        all_cats.append(data)
    
    # Create a map for easy access
    cat_map = {c['id']: c for c in all_cats}
    
    roots = []
    for cat in all_cats:
        pid = cat.get('parent_id')
        # Check if parent exists in the current filtered set
        if pid and pid in cat_map:
            cat_map[pid]['subcategories'].append(cat)
        else:
            # If no parent or parent not found in this query (e.g. type filter mismatch), treat as root
            roots.append(cat)
            
    return [Category(**c) for c in roots]

def update_category(category_id: str, category_in: CategoryCreate, user_id: str) -> Category:
    db = get_db()
    doc_ref = db.collection(COLLECTION_NAME).document(category_id)
    doc = doc_ref.get()
    
    # Verifica existência e propriedade
    if not doc.exists or doc.to_dict().get('user_id') != user_id:
        raise HTTPException(status_code=404, detail="Category not found or access denied")
        
    data = category_in.model_dump()
    data['user_id'] = user_id # Garante que não perde o dono
    doc_ref.update(data)
    
    return Category(id=category_id, **data)

def delete_category(category_id: str, user_id: str):
    db = get_db()
    doc_ref = db.collection(COLLECTION_NAME).document(category_id)
    doc = doc_ref.get()

    if not doc.exists or doc.to_dict().get('user_id') != user_id:
        raise HTTPException(status_code=404, detail="Category not found")

    # Check for subcategories
    children_query = db.collection(COLLECTION_NAME)\
        .where("parent_id", "==", category_id)\
        .limit(1)\
        .stream()
    
    # Convert generator to list to check if empty
    if any(children_query):
         raise HTTPException(status_code=400, detail="Cannot delete category with subcategories. Please delete or move them first.")

    doc_ref.delete()
    return {"status": "success"}
from app.core.database import get_db
from app.schemas.category import CategoryCreate, Category, CategoryType
from fastapi import HTTPException
from typing import Optional, List, Dict, Any

COLLECTION_NAME = "categories"

def create_category(category_in: CategoryCreate, user_id: str) -> Category:
    db = get_db()
    data = category_in.model_dump()
    data['user_id'] = user_id # Marca o dono
    
    update_time, doc_ref = db.collection(COLLECTION_NAME).add(data)
    return Category(id=doc_ref.id, **data)

def list_categories(user_id: str, cat_type: Optional[CategoryType] = None) -> List[Category]:
    db = get_db()
    # Filtra apenas categorias do usuário
    query = db.collection(COLLECTION_NAME).where("user_id", "==", user_id)
    
    if cat_type:
        query = query.where("type", "==", cat_type.value)
        
    docs = query.stream()
    
    all_cats: List[Dict[str, Any]] = []
    for doc in docs:
        data = doc.to_dict()
        data['id'] = doc.id
        data['subcategories'] = []
        all_cats.append(data)
    
    # Create a map for easy access
    cat_map = {c['id']: c for c in all_cats}
    
    roots = []
    for cat in all_cats:
        pid = cat.get('parent_id')
        # Check if parent exists in the current filtered set
        if pid and pid in cat_map:
            cat_map[pid]['subcategories'].append(cat)
        else:
            # If no parent or parent not found in this query (e.g. type filter mismatch), treat as root
            roots.append(cat)
            
    return [Category(**c) for c in roots]

def update_category(category_id: str, category_in: CategoryCreate, user_id: str) -> Category:
    db = get_db()
    doc_ref = db.collection(COLLECTION_NAME).document(category_id)
    doc = doc_ref.get()
    
    # Verifica existência e propriedade
    if not doc.exists or doc.to_dict().get('user_id') != user_id:
        raise HTTPException(status_code=404, detail="Category not found or access denied")
        
    data = category_in.model_dump()
    data['user_id'] = user_id # Garante que não perde o dono
    doc_ref.update(data)
    
    return Category(id=category_id, **data)

def delete_category(category_id: str, user_id: str):
    db = get_db()
    doc_ref = db.collection(COLLECTION_NAME).document(category_id)
    doc = doc_ref.get()

    if not doc.exists or doc.to_dict().get('user_id') != user_id:
        raise HTTPException(status_code=404, detail="Category not found")

    # Check for subcategories
    children_query = db.collection(COLLECTION_NAME)\
        .where("parent_id", "==", category_id)\
        .limit(1)\
        .stream()
    
    # Convert generator to list to check if empty
    if any(children_query):
         raise HTTPException(status_code=400, detail="Cannot delete category with subcategories. Please delete or move them first.")

    doc_ref.delete()
    return {"status": "success"}

# Helper interno (sem filtro de user_id rigoroso aqui pois é usado pelo get internal)
def get_category(category_id: str):
    if not category_id: return None
    db = get_db()
    doc = db.collection(COLLECTION_NAME).document(category_id).get()
    if doc.exists:
        return Category(id=doc.id, **doc.to_dict())
    return None

def delete_all_custom_categories(user_id: str):
    db = get_db()
    # Delete only categories belonging to the user
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