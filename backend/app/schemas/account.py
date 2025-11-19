from pydantic import BaseModel, Field
from enum import Enum

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

class AccountCreate(AccountBase):
    pass

class Account(AccountBase):
    id: str

    class COnfig:
     from_attributes = True