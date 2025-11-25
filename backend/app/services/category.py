from app.core.database import get_db
from app.schemas.category import CategoryCreate, Category
from fastapi import HTTPException

COLLECTION_NAME = "categories"

def create_category(category_in: CategoryCreate, user_id: str) -> Category:
    db = get_db()
    data = category_in.model_dump()
    data['user_id'] = user_id # Marca o dono
    
    update_time, doc_ref = db.collection(COLLECTION_NAME).add(data)
    return Category(id=doc_ref.id, **data)

def list_categories(user_id: str) -> list[Category]:
    db = get_db()
    # Filtra apenas categorias do usuário
    docs = db.collection(COLLECTION_NAME).where("user_id", "==", user_id).stream()
    
    categories = []
    for doc in docs:
        categories.append(Category(id=doc.id, **doc.to_dict()))
    return categories

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