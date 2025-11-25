from pydantic import BaseModel, Field, field_validator
from typing import Optional
from enum import Enum
from app.core.validators import sanitize_html

# 1. A definição do ENUM deve vir PRIMEIRO
class CategoryType(str, Enum):
    EXPENSE = "expense"
    INCOME = "income"

# 2. Agora podemos usar o CategoryType dentro da classe Base
class CategoryBase(BaseModel):
    name: str = Field(..., min_length=2, description="Nome da categoria")
    icon: str = Field(default="pi pi-tag", description="Ícone visual")
    color: str = Field(default="#3b82f6", description="Cor hexadecimal")
    is_custom: bool = Field(default=True, description="Se foi criada pelo usuário")
    
    # Aqui usamos o Enum definido acima
    type: CategoryType = Field(default=CategoryType.EXPENSE, description="Tipo: expense ou income")

    # --- BLOCO DE PROTEÇÃO XSS ---
    @field_validator('name')
    @classmethod # No Pydantic v2 usamos @classmethod as vezes, mas field_validator cuida disso
    def clean_name(cls, v):
        return sanitize_html(v)
    # -----------------------------

# 3. Classes derivadas
class CategoryCreate(CategoryBase):
    pass

class Category(CategoryBase):
    id: str

    class Config:
        from_attributes = True