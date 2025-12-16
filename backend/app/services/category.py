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

def ensure_default_categories(user_id: str):
    """
    Garante que o usuário tenha as categorias padrão.
    Se não tiver nenhuma categoria, cria todas.
    Se já tiver, verifica apenas se a Fatura Cartão (sistema) existe.
    """
    db = get_db()
    
    # 1. Verifica categorias existentes
    existing = list_categories(user_id)
    existing_names = {c.name: c for c in existing}
    
    # Lista de Categorias Padrão
    defaults = [
        # --- DESPESAS ---
        {"name": "Moradia", "icon": "pi pi-home", "color": "#F87171", "type": CategoryType.EXPENSE, "subcategories": [
            {"name": "Aluguel/Condomínio", "icon": "pi pi-home", "color": "#F87171", "type": CategoryType.EXPENSE},
            {"name": "Energia Elétrica", "icon": "pi pi-bolt", "color": "#F87171", "type": CategoryType.EXPENSE},
            {"name": "Água/Esgoto", "icon": "pi pi-filter", "color": "#F87171", "type": CategoryType.EXPENSE},
            {"name": "Internet/TV", "icon": "pi pi-wifi", "color": "#F87171", "type": CategoryType.EXPENSE},
            {"name": "Manutenção Casa", "icon": "pi pi-wrench", "color": "#F87171", "type": CategoryType.EXPENSE}
        ]},
        {"name": "Alimentação", "icon": "pi pi-shopping-cart", "color": "#FB923C", "type": CategoryType.EXPENSE, "subcategories": [
            {"name": "Mercado", "icon": "pi pi-shopping-cart", "color": "#FB923C", "type": CategoryType.EXPENSE},
            {"name": "Restaurante", "icon": "pi pi-ticket", "color": "#FB923C", "type": CategoryType.EXPENSE},
            {"name": "Delivery/Apps", "icon": "pi pi-truck", "color": "#FB923C", "type": CategoryType.EXPENSE},
            {"name": "Padaria/Café", "icon": "pi pi-coffee", "color": "#FB923C", "type": CategoryType.EXPENSE}
        ]},
        {"name": "Transporte", "icon": "pi pi-car", "color": "#FACC15", "type": CategoryType.EXPENSE, "subcategories": [
            {"name": "Combustível", "icon": "pi pi-filter-fill", "color": "#FACC15", "type": CategoryType.EXPENSE},
            {"name": "Aplicativos (Uber/99)", "icon": "pi pi-mobile", "color": "#FACC15", "type": CategoryType.EXPENSE},
            {"name": "Transporte Público", "icon": "pi pi-ticket", "color": "#FACC15", "type": CategoryType.EXPENSE},
            {"name": "Manutenção Veículo", "icon": "pi pi-wrench", "color": "#FACC15", "type": CategoryType.EXPENSE},
            {"name": "Estacionamento", "icon": "pi pi-map-marker", "color": "#FACC15", "type": CategoryType.EXPENSE}
        ]},
        {"name": "Saúde", "icon": "pi pi-heart", "color": "#4ADE80", "type": CategoryType.EXPENSE, "subcategories": [
            {"name": "Farmácia", "icon": "pi pi-plus-circle", "color": "#4ADE80", "type": CategoryType.EXPENSE},
            {"name": "Consultas/Exames", "icon": "pi pi-user-plus", "color": "#4ADE80", "type": CategoryType.EXPENSE},
            {"name": "Plano de Saúde", "icon": "pi pi-heart", "color": "#4ADE80", "type": CategoryType.EXPENSE}
        ]},
        {"name": "Educação", "icon": "pi pi-book", "color": "#2DD4BF", "type": CategoryType.EXPENSE, "subcategories": [
            {"name": "Cursos", "icon": "pi pi-desktop", "color": "#2DD4BF", "type": CategoryType.EXPENSE},
            {"name": "Livros/Material", "icon": "pi pi-book", "color": "#2DD4BF", "type": CategoryType.EXPENSE},
            {"name": "Mensalidade Escolar", "icon": "pi pi-building", "color": "#2DD4BF", "type": CategoryType.EXPENSE}
        ]},
         {"name": "Lazer", "icon": "pi pi-star", "color": "#60A5FA", "type": CategoryType.EXPENSE, "subcategories": [
            {"name": "Streaming", "icon": "pi pi-play", "color": "#60A5FA", "type": CategoryType.EXPENSE},
            {"name": "Viagens", "icon": "pi pi-map", "color": "#60A5FA", "type": CategoryType.EXPENSE},
            {"name": "Cinema/Shows", "icon": "pi pi-ticket", "color": "#60A5FA", "type": CategoryType.EXPENSE},
            {"name": "Bares/Festas", "icon": "pi pi-glass-cheers", "color": "#60A5FA", "type": CategoryType.EXPENSE} # glass-cheers not in primeicons v4, using alternative?
        ]},
        {"name": "Compras", "icon": "pi pi-shopping-bag", "color": "#818CF8", "type": CategoryType.EXPENSE, "subcategories": [
            {"name": "Roupas/Acessórios", "icon": "pi pi-user", "color": "#818CF8", "type": CategoryType.EXPENSE},
            {"name": "Eletrônicos", "icon": "pi pi-desktop", "color": "#818CF8", "type": CategoryType.EXPENSE},
            {"name": "Presentes", "icon": "pi pi-gift", "color": "#818CF8", "type": CategoryType.EXPENSE}
        ]},
        {"name": "Pets", "icon": "pi pi-github", "color": "#A78BFA", "type": CategoryType.EXPENSE, "subcategories": [ # pi-github as placeholder for paw/pet if not available
            {"name": "Ração", "icon": "pi pi-box", "color": "#A78BFA", "type": CategoryType.EXPENSE},
            {"name": "Veterinário", "icon": "pi pi-user", "color": "#A78BFA", "type": CategoryType.EXPENSE}
        ]},
        {"name": "Taxas e Impostos", "icon": "pi pi-money-bill", "color": "#F472B6", "type": CategoryType.EXPENSE, "subcategories": [
            {"name": "Taxas Bancárias", "icon": "pi pi-percentage", "color": "#F472B6", "type": CategoryType.EXPENSE},
            {"name": "Impostos", "icon": "pi pi-money-bill", "color": "#F472B6", "type": CategoryType.EXPENSE}
        ]},
        
        # --- RECEITAS ---
        {"name": "Salário", "icon": "pi pi-briefcase", "color": "#34D399", "type": CategoryType.INCOME, "subcategories": [
             {"name": "Salário Mensal", "icon": "pi pi-money-bill", "color": "#34D399", "type": CategoryType.INCOME},
             {"name": "Adiantamento", "icon": "pi pi-wallet", "color": "#34D399", "type": CategoryType.INCOME},
             {"name": "13º Salário/Férias", "icon": "pi pi-calendar", "color": "#34D399", "type": CategoryType.INCOME}
        ]},
        {"name": "Renda Extra", "icon": "pi pi-bolt", "color": "#FBBF24", "type": CategoryType.INCOME, "subcategories": [
             {"name": "Freelance", "icon": "pi pi-desktop", "color": "#FBBF24", "type": CategoryType.INCOME},
             {"name": "Vendas", "icon": "pi pi-shopping-bag", "color": "#FBBF24", "type": CategoryType.INCOME}
        ]},
        {"name": "Investimentos", "icon": "pi pi-chart-line", "color": "#60A5FA", "type": CategoryType.INCOME, "subcategories": [
             {"name": "Dividendos", "icon": "pi pi-dollar", "color": "#60A5FA", "type": CategoryType.INCOME},
             {"name": "Rendimentos", "icon": "pi pi-chart-bar", "color": "#60A5FA", "type": CategoryType.INCOME}
        ]},
        {"name": "Presentes/Doações", "icon": "pi pi-gift", "color": "#F472B6", "type": CategoryType.INCOME, "subcategories": []},

        # --- SISTEMA ---
        {"name": "Fatura Cartão", "icon": "pi pi-credit-card", "color": "#94A3B8", "type": CategoryType.TRANSFER, "is_hidden": True}
    ]

    # Batch para criação eficiente
    batch = db.batch()
    new_categories = []
    
    # Se não tiver NENHUMA categoria, cria todas
    # Se tiver algumas, verifica especificamente Fatura Cartão
    
    # Estratégia:
    # 1. Se "Fatura Cartão" não existir, cria.
    if "Fatura Cartão" not in existing_names:
        fat_data = [d for d in defaults if d["name"] == "Fatura Cartão"][0]
        ref = db.collection(COLLECTION_NAME).document()
        fat_cat = CategoryCreate(
            name=fat_data["name"],
            icon=fat_data["icon"],
            color=fat_data["color"],
            type=fat_data["type"],
            is_hidden=fat_data.get("is_hidden", False),
            is_custom=False
        ).model_dump()
        fat_cat["user_id"] = user_id
        batch.set(ref, fat_cat)
        
    # 2. Verifica cada categoria padrão e cria se não existir
    for cat_data in defaults:
        if cat_data["name"] == "Fatura Cartão": continue # Já tratada acima (ou poderia ser tratada aqui, mas ok manter separado)
        
        # Se a categoria pai já existe, pulamos (assumimos que o usuário já tem ou não quer)
        # OU podemos querer "mesclar" subcategorias? 
        # Por segurança/simplicidade: Se a categoria Principal não existe, cria ela e as subs.
        if cat_data["name"] not in existing_names:
            
            # Cria Pai
            parent_ref = db.collection(COLLECTION_NAME).document()
            parent_payload = CategoryCreate(
                name=cat_data["name"],
                icon=cat_data["icon"],
                color=cat_data["color"],
                type=cat_data["type"],
                is_custom=False
            ).model_dump()
            parent_payload["user_id"] = user_id
            batch.set(parent_ref, parent_payload)
            
            # Cria Filhos (se houver)
            if "subcategories" in cat_data:
                for sub in cat_data["subcategories"]:
                    sub_ref = db.collection(COLLECTION_NAME).document()
                    sub_payload = CategoryCreate(
                        name=sub["name"],
                        icon=sub["icon"],
                        color=sub["color"],
                        type=sub["type"],
                        parent_id=parent_ref.id,
                        is_custom=False
                    ).model_dump()
                    sub_payload["user_id"] = user_id
                    batch.set(sub_ref, sub_payload)
    
    batch.commit()
    return {"status": "setup_completed"}

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