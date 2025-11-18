from pydantic import BaseModel, Field
from typing import Optional

# 1. Base: O que toda categoria tem
class CategoryBase(BaseModel):
     name: str = Field(..., min_lenght=2, max_length=20, description="Nome da categoria")
     icon: str = Field(default="default_icon", description="Identificador do ícone (string)")
     color: str = Field(default="#000000", description="cor em Hex")
     is_custom: bool = Field(default=True, description="Se foi criada pelo usuário ou é padrão do sistema")


# 2. Create: O que precisamos para criar uma
class CategoryCreate(CategoryBase):
     pass

# 3. Response: O que devolvemos para o Frontend?
# (Inclui o ID, que é gerado pelo banco de dados, não pelo usuário)
class Category(CategoryBase):
     id: str

     class Config:
          from_attributes = True