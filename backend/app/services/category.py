from app.core.database import get_db
from app.schemas.category import CategoryCreate, Category

from fastapi import HTTPException

# Nome da "pasta" (coleção) lá no Firestore onde guardaremos isso
COLLECTION_NAME = "categories"

def create_category(category_in: CategoryCreate):
     """
    Recebe os dados da nova categoria e salva no Firestore.
    """
     db = get_db()

     # 1. Converte o modelo Pydantic para dicionário (JSON)
     data = category_in.model_dump()

     # 2. Salva no banco (o Firestore gera um ID único automaticamente)
     update_time, category_ref = db.collection(COLLECTION_NAME).add(data)

     # 3. Retornamos o objeto completo com o ID gerado
    # (Isso é útil para o frontend já saber o ID do que acabou de criar)
     return Category(id=category_ref.id, **data)

def get_category(category_id: str) -> Category:
     """
     Busca um categoria pelo ID.
     """

     db = get_db()
     doc_ref = db.collection(COLLECTION_NAME).document(category_id)
     doc = doc_ref.get()

     if doc.exists:
          return Category(id=doc.id, **doc.to_dict())
     return None

def list_categories() -> list[Category]:
     """
     Lista todas as categorias.
     """

     db = get_db()
     docs = db.collection(COLLECTION_NAME).stream()

     categories = []
     for doc in docs:
          # Para cada documento encontrado, criamos nosso objeto Category
          categories.append(Category(id=doc.id, **doc.to_dict()))

     return categories

def update_category(category_id: str, category_in: CategoryCreate) -> Category:
    db = get_db()
    doc_ref = db.collection(COLLECTION_NAME).document(category_id)
    
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Category not found")
        
    data = category_in.model_dump()
    doc_ref.update(data)
    return Category(id=category_id, **data)

def delete_category(category_id: str):
    db = get_db()
    db.collection(COLLECTION_NAME).document(category_id).delete()
    return {"status": "success"}

