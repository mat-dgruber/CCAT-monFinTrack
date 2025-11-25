from pydantic import BaseModel, Field, field_validator
from .category import Category
from app.core.validators import sanitize_html

class BudgetBase(BaseModel):
    amount: float = Field(..., gt=0, description="Limite de gasto mensal")
    
class BudgetCreate(BudgetBase):
    category_id: str = Field(..., description="ID da categoria vinculada")

class Budget(BudgetBase):
    id: str
    category_id: str
    # Opcional: Podemos incluir o objeto categoria completo se quisermos mostrar o ícone
    category: Category | None = None

    class Config:
        from_attributes = True