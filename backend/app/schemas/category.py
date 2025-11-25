from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum

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

# 3. Classes derivadas
class CategoryCreate(CategoryBase):
    pass

class Category(CategoryBase):
    id: str

    class Config:
        from_attributes = True