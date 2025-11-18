from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum
from .category import Category


# 1. Definindo as Listas Fixas (Enums)
class TransactionType(str, Enum):
     EXPENSE = "expense"
     INCOME = "income"

class PaymentMethod(str, Enum):
     CREDIT_CARD = "credit_card"
     DEBIT_CARD = "debit_card"
     CASH = "cash"
     PIX = "pix"
     BANK_TRANSFER = "bank_transfer"
     OTHER = "other"


# 2. Base: Campos comuns que não dependem de relacionamento
class TransactionBase(BaseModel):
     description: str = Field(..., min_length=3, description="Descrição da transação")
     amount: float = Field(..., gt=0, description="Valor da transação")
     date: datetime = Field(default_factory=datetime.now, description="Data da transação")
     type: TransactionType = Field(default=TransactionType.EXPENSE, description="Tipo: Despesa ou Receita")
     payment_method: PaymentMethod = Field(..., description="Forma de pagamento")


# 3. Create: O que precisamos receber para CRIAR uma despesa?
class TransactionCreate(TransactionBase):
     category_id = str = Field(..., description="ID da categoria")

# 4. Response: O que devolvemos para o Frontend?
# (Inclui o ID, que é gerado pelo banco de dados, não pelo usuário)
# Para ler, queremos o objeto Categoria completo (nome, cor, icone)
class Transaction(TransactionBase):
     id: str
     category: Category


     class Config:
          from_attributes = True
