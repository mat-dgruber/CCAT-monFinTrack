from pydantic import BaseModel, Field, field_validator
from datetime import datetime, date
from typing import Optional, List
from enum import Enum
from app.core.validators import sanitize_html
from app.schemas.transaction import TransactionType

class RecurrencePeriodicity(str, Enum):
    MONTHLY = "monthly"
    WEEKLY = "weekly"
    YEARLY = "yearly"

class RecurrenceBase(BaseModel):
    name: str = Field(..., min_length=3, description="Nome da recorrência (ex: Netflix)")
    amount: float = Field(..., gt=0, description="Valor fixo da recorrência")
    category_id: str = Field(..., description="ID da categoria")
    account_id: str = Field(..., description="ID da conta")
    payment_method_id: Optional[str] = Field(None, description="ID da forma de pagamento")
    credit_card_id: Optional[str] = Field(None, description="ID do cartão de crédito (se aplicável)")
    periodicity: RecurrencePeriodicity = Field(..., description="Periodicidade")
    auto_pay: bool = Field(False, description="Se true, gera como PAGO. Se false, PENDENTE.")
    due_day: int = Field(..., ge=1, le=31, description="Dia base de vencimento")
    due_month: Optional[int] = Field(None, ge=1, le=12, description="Mês de vencimento para recorrências anuais")
    active: bool = Field(True, description="Se a recorrência está ativa")
    skipped_dates: List[date] = Field(default_factory=list, description="Lista de datas (vencimentos) puladas/excluídas")
    
    # Novo campo para suportar Transferência (Pagamento de Fatura)
    type: TransactionType = Field(default=TransactionType.EXPENSE, description="Tipo da transação gerada")

    @field_validator('name')
    @classmethod
    def clean_name(cls, v):
        return sanitize_html(v)

class RecurrenceCreate(RecurrenceBase):
    pass

class RecurrenceUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[float] = None
    category_id: Optional[str] = None
    account_id: Optional[str] = None
    payment_method_id: Optional[str] = None
    periodicity: Optional[RecurrencePeriodicity] = None
    auto_pay: Optional[bool] = None
    due_day: Optional[int] = None
    due_month: Optional[int] = None
    active: Optional[bool] = None
    last_processed_at: Optional[datetime] = None
    type: Optional[TransactionType] = None
    skipped_dates: Optional[List[date]] = None

class Recurrence(RecurrenceBase):
    id: str
    user_id: str
    created_at: datetime = Field(default_factory=datetime.now)
    last_processed_at: Optional[datetime] = None
    cancellation_date: Optional[date] = None

    class Config:
        from_attributes = True
