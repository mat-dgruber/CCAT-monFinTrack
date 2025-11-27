from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional
from enum import Enum
from .category import Category
from .account import Account
from app.core.validators import sanitize_html


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

class TransactionStatus(str, Enum):
     PENDING = "pending"
     PAID = "paid"



# 2. Base: Campos comuns que não dependem de relacionamento
class TransactionBase(BaseModel):
     description: str = Field(..., min_length=3, description="Descrição da transação")
     amount: float = Field(..., gt=0, description="Valor da transação")
     date: datetime = Field(default_factory=datetime.now, description="Data da transação")
     type: TransactionType = Field(default=TransactionType.EXPENSE, description="Tipo: Despesa ou Receita")
     payment_method: PaymentMethod = Field(..., description="Forma de pagamento")
     status: TransactionStatus = Field(default=TransactionStatus.PAID, description="Status da transação")
     payment_date: Optional[datetime] = Field(None, description="Data efetiva do pagamento")
     
     # Novos campos opcionais na Base também, para leitura
     recurrence_id: Optional[str] = None
     installment_group_id: Optional[str] = None
     installment_number: Optional[int] = None
     total_installments: Optional[int] = None

     # --- BLOCO DE PROTEÇÃO XSS ---
     @field_validator('description')
     @classmethod # No Pydantic v2 usamos @classmethod as vezes, mas field_validator cuida disso
     def clean_description(cls, v):
          return sanitize_html(v)
     # -----------------------------

# 3. Create: O que precisamos receber para CRIAR uma despesa?
class TransactionCreate(TransactionBase):
     category_id: str = Field(..., description="ID da categoria")
     account_id: str = Field(..., description="ID da conta")
     
     # Novos campos para Recorrência e Parcelamento
     recurrence_id: Optional[str] = Field(None, description="ID da recorrência pai")
     installment_group_id: Optional[str] = Field(None, description="ID do grupo de parcelamento")
     installment_number: Optional[int] = Field(None, description="Número da parcela (ex: 1)")
     installment_number: Optional[int] = Field(None, description="Número da parcela (ex: 1)")
     total_installments: Optional[int] = Field(None, description="Total de parcelas (ex: 10)")
     
     # Campos para criar Recorrência (Cenário B)
     is_recurrence: bool = Field(False, description="Se true, cria uma recorrência ao invés de transação única")
     recurrence_periodicity: Optional[str] = Field(None, description="Periodicidade (mensal, anual...)")
     recurrence_auto_pay: bool = Field(False, description="Pagamento automático?")
     recurrence_create_first: bool = Field(True, description="Gerar a primeira transação agora?")



# 4. Response: O que devolvemos para o Frontend?
# (Inclui o ID, que é gerado pelo banco de dados, não pelo usuário)
# Para ler, queremos o objeto Categoria completo (nome, cor, icone)
class Transaction(TransactionBase):
     id: str
     category: Category
     account: Account


     class Config:
          from_attributes = True
