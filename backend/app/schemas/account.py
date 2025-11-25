from pydantic import BaseModel, Field, field_validator
from enum import Enum
from typing import List
from app.core.validators import sanitize_html

# Tipos de Conta
class AccountType(str, Enum):
    CHECKING = "checking"       # Conta Corrente
    SAVINGS = "savings"         # Poupança
    INVESTMENT = "investment"   # Investimentos
    CASH = "cash"               # Dinheiro Físico
    CREDIT_CARD = "credit_card" # Cartão de Crédito (sim, cartão pode ser uma 'conta' negativa)
    OTHER = "other"

class AccountBase(BaseModel):
    name: str = Field(..., min_length=2, description="Nome da Conta (ex: Nubank, C6 Bank, etc")
    type: AccountType = Field(default=AccountType.CHECKING, description="Tipo de Conta")
    balance: float = Field(default=0, description="Saldo da Conta")
    color: str = Field(default="#3b82f6", description="Cor da Conta em HEX")
    icon: str = Field(default="", description="Ícone da Conta")

    # --- BLOCO DE PROTEÇÃO XSS ---
    @field_validator('name')
    @classmethod # No Pydantic v2 usamos @classmethod as vezes, mas field_validator cuida disso
    def clean_name(cls, v):
        return sanitize_html(v)
    # -----------------------------

class AccountCreate(AccountBase):
    pass

class Account(AccountBase):
    id: str

    class Config:
        from_attributes = True