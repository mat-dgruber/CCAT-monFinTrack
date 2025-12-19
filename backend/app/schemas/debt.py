from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import date
from app.models.debt import DebtType, InterestPeriod, AmortizationSystem
from app.core.validators import sanitize_html

class DebtBase(BaseModel):
    name: str = Field(..., min_length=2, description="Nome da dívida (ex: Nubank, Financiamento Casa)")
    debt_type: DebtType = Field(default=DebtType.OTHER, description="Tipo da dívida")
    
    total_amount: float = Field(..., ge=0, description="Saldo Devedor Atual")
    original_amount: Optional[float] = Field(default=None, ge=0, description="Valor Original (ou negociado)")
    
    interest_rate: float = Field(..., ge=0, description="Taxa de Juros (%)")
    interest_period: InterestPeriod = Field(default=InterestPeriod.MONTHLY, description="Período da taxa (Mensal/Anual)")
    
    cet: Optional[float] = Field(default=None, ge=0, description="Custo Efetivo Total (%)")
    
    minimum_payment: Optional[float] = Field(default=None, ge=0, description="Pagamento Mínimo (obrigatório para Cartão/Cheque)")
    due_day: Optional[int] = Field(default=None, ge=1, le=31, description="Dia do vencimento")
    
    remaining_installments: Optional[int] = Field(default=None, ge=0, description="Parcelas restantes (para financiamentos/parcelados)")
    
    category_id: Optional[str] = Field(default=None, description="Categoria de despesa vinculada")
    
    # Advanced / Premium / Financing
    contract_file_path: Optional[str] = Field(default=None, description="Caminho do contrato analisado (Premium)")
    amortization_system: Optional[AmortizationSystem] = Field(default=AmortizationSystem.NONE, description="Sistema de amortização (SAC/PRICE)")
    is_subsidized: bool = Field(default=False, description="Se possui subsídio (ex: MCMV)")

    @field_validator('name')
    @classmethod
    def clean_name(cls, v):
        return sanitize_html(v)

class DebtCreate(DebtBase):
    pass

class DebtUpdate(BaseModel):
    name: Optional[str] = None
    debt_type: Optional[DebtType] = None
    total_amount: Optional[float] = None
    original_amount: Optional[float] = None
    interest_rate: Optional[float] = None
    interest_period: Optional[InterestPeriod] = None
    cet: Optional[float] = None
    minimum_payment: Optional[float] = None
    due_day: Optional[int] = None
    remaining_installments: Optional[int] = None
    category_id: Optional[str] = None
    contract_file_path: Optional[str] = None
    amortization_system: Optional[AmortizationSystem] = None
    is_subsidized: Optional[bool] = None

class Debt(DebtBase):
    id: str
    user_id: str
    created_at: Optional[str] = None # Firestore timestamp handling might be dynamic

    class Config:
        from_attributes = True

# --- Payment Plan Schemas ---

class PaymentStep(BaseModel):
    month_index: int
    date: str # YYYY-MM-DD
    payment_amount: float
    interest_paid: float
    principal_paid: float
    remaining_balance: float
    debt_id: str
    debt_name: str

class DebtPayoffSummary(BaseModel):
    debt_id: str
    debt_name: str
    total_interest_paid: float
    payoff_months: int
    payoff_date: str

class PaymentPlan(BaseModel):
    strategy: str # 'snowball' or 'avalanche'
    monthly_budget: float
    total_interest_paid: float
    total_months: int
    payoff_date: str
    steps: List[PaymentStep]
    debt_summaries: List[DebtPayoffSummary]
