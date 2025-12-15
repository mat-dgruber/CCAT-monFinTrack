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


# Modelo de Cartão de Crédito Aninhado
class CreditCardBrand(str, Enum):
    VISA = "visa"
    MASTERCARD = "mastercard"
    ELO = "elo"
    AMEX = "amex"
    HIPERCARD = "hipercard"
    OTHER = "other"

class CreditCard(BaseModel):
    id: str = Field(..., description="ID único do cartão")
    name: str = Field(..., min_length=2, description="Nome do cartão (ex: Nubank Gold)")
    brand: CreditCardBrand = Field(default=CreditCardBrand.OTHER, description="Bandeira")
    limit: float = Field(default=0.0, description="Limite do cartão")
    closing_day: int = Field(..., ge=1, le=31, description="Dia de fechamento da fatura")
    invoice_due_day: int = Field(..., ge=1, le=31, description="Dia de vencimento da fatura")
    color: str = Field(default="#000000", description="Cor do cartão")

class AccountBase(BaseModel):
    name: str = Field(..., min_length=2, description="Nome da Conta (ex: Nubank, C6 Bank, etc")
    type: AccountType = Field(default=AccountType.CHECKING, description="Tipo de Conta")
    balance: float = Field(default=0, description="Saldo da Conta")
    color: str = Field(default="#3b82f6", description="Cor da Conta em HEX")
    icon: str = Field(default="", description="Ícone da Conta")
    
    # Lista de Cartões de Crédito vinculados a esta conta
    credit_cards: List[CreditCard] = Field(default=[], description="Cartões de crédito vinculados")

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
