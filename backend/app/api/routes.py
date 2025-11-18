from fastapi import APIRouter, HTTPException
from typing import List

from app.schemas.category import Category, CategoryCreate
from app.services import category as category_service

router = APIRouter()

# --- Rotas de Categorias ---

@router.post("/categories/", response_model=Category)
def create_new_category(category: CategoryCreate):
    return category_service.create_category(category)

@router.get("/categories/", response_model=List[Category])
def read_categories():
    return category_service.list_categories()