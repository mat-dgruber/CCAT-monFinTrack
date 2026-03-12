#app/schemas/debt.py
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import date
from app.models.debt import DebtType, InterestPeriod, AmortizationSystem, CardBrand, IndexerType, DebtStatus
from app.core.validators import sanitize_html

class DebtBase(BaseModel):
    name: str = Field(default="Nova Dívida", min_length=2, description="Nome da dívida (ex: Nubank, Financiamento Casa)")
    debt_type: DebtType = Field(default=DebtType.OTHER, description="Tipo da dívida")
    status: DebtStatus = Field(default=DebtStatus.ON_TIME, description="Status da dívida")

    total_amount: float = Field(default=0.0, ge=0, description="Saldo Devedor Atual")
    original_amount: Optional[float] = Field(default=0.0, ge=0, description="Valor Original")
    
    interest_rate: float = Field(default=0.0, ge=0, description="Taxa de Juros (%)")
    interest_period: InterestPeriod = Field(default=InterestPeriod.MONTHLY, description="Período da taxa")
    
    cet: Optional[float] = Field(default=0.0, ge=0, description="Custo Efetivo Total (%)")
    
    minimum_payment: Optional[float] = Field(default=0.0, ge=0, description="Encargo Mensal / Mínimo")
    due_day: Optional[int] = Field(default=None, ge=1, le=31, description="Dia do vencimento")
    closing_day: Optional[int] = Field(default=None, ge=1, le=31, description="Dia de fechamento")
    
    remaining_installments: Optional[int] = Field(default=None, ge=0, description="Parcelas restantes")
    category_id: Optional[str] = Field(default=None, description="Categoria vinculada")
    
    # --- Advanced Fields ---
    card_brand: Optional[CardBrand] = Field(default=None)
    card_limit: Optional[float] = Field(default=None, ge=0)
    contract_number: Optional[str] = Field(default=None)
    allow_early_amortization: bool = Field(default=True)
    
    indexer: Optional[IndexerType] = Field(default=None)
    insurance_value: Optional[float] = Field(default=None, ge=0)
    administration_fee: Optional[float] = Field(default=None, ge=0)
    property_value: Optional[float] = Field(default=None, ge=0)
    current_property_value: Optional[float] = Field(default=None, ge=0)
    fgts_usage_interval: Optional[int] = Field(default=24)
    last_fgts_usage_date: Optional[date] = Field(default=None)
    estimated_fgts_balance: Optional[float] = Field(default=0.0, ge=0)
    
    is_under_construction: bool = Field(default=False)
    construction_end_date: Optional[date] = Field(default=None)
    total_installments: Optional[int] = Field(default=None, ge=1)
    installments_paid: Optional[int] = Field(default=0, ge=0)
    subsidy_amount: Optional[float] = Field(default=0, ge=0)
    subsidy_expiration_date: Optional[date] = Field(default=None)
    
    daily_interest_rate: Optional[float] = Field(default=None, ge=0)
    days_used_in_month: Optional[int] = Field(default=0, ge=0, le=31)

    # --- Vehicle Financing ---
    vehicle_brand: Optional[str] = Field(default=None)
    vehicle_model: Optional[str] = Field(default=None)
    vehicle_year: Optional[int] = Field(default=None)
    vehicle_plate: Optional[str] = Field(default=None)
    vehicle_renavam: Optional[str] = Field(default=None)
    gravame_registered: Optional[bool] = Field(default=False)
    vehicle_insurance_active: Optional[bool] = Field(default=False)
    vehicle_insurance_expiry: Optional[date] = Field(default=None)
    ipva_paid: Optional[bool] = Field(default=False)
    licensing_ok: Optional[bool] = Field(default=False)

    # --- Credit Card Rotating / Installment ---
    card_current_bill: Optional[float] = Field(default=None, ge=0)
    card_closing_date: Optional[date] = Field(default=None)
    card_minimum_payment_pct: Optional[float] = Field(default=0.15)
    months_in_revolving: Optional[int] = Field(default=0, ge=0)

    # --- Credit Card Installment (Specific Purchase) ---
    purchase_description: Optional[str] = Field(default=None)
    purchase_date: Optional[date] = Field(default=None)
    has_interest: Optional[bool] = Field(default=False)

    # --- Overdraft ---
    overdraft_limit: Optional[float] = Field(default=None, ge=0)
    overdraft_used: Optional[float] = Field(default=None, ge=0)
    overdraft_days_used: Optional[int] = Field(default=0, ge=0, le=31)
    overdraft_start_date: Optional[date] = Field(default=None)

    # --- Consigned Credit ---
    consigned_type: Optional[str] = Field(default=None)
    payroll_org: Optional[str] = Field(default=None)
    consigned_margin_used: Optional[float] = Field(default=None)
    consigned_years_committed: Optional[int] = Field(default=None)
    consigned_end_year: Optional[int] = Field(default=None)
    blocks_fgts_withdrawal: Optional[bool] = Field(default=False)

    contract_file_path: Optional[str] = Field(default=None)
    amortization_system: Optional[AmortizationSystem] = Field(default=AmortizationSystem.NONE)
    is_subsidized: bool = Field(default=False)
    report: Optional[str] = Field(default=None, description="Relatório de análise gerado pela IA")

    @field_validator('name')
    @classmethod
    def clean_name(cls, v):
        return sanitize_html(v)

class DebtCreate(DebtBase):
    # Enforce required fields for new debts
    name: str = Field(..., min_length=2)
    total_amount: float = Field(..., ge=0)
    interest_rate: float = Field(..., ge=0)
    debt_type: DebtType = Field(..., description="Tipo da dívida")

class DebtUpdate(BaseModel):
    name: Optional[str] = None
    debt_type: Optional[DebtType] = None
    status: Optional[DebtStatus] = None
    total_amount: Optional[float] = None
    original_amount: Optional[float] = None
    interest_rate: Optional[float] = None
    interest_period: Optional[InterestPeriod] = None
    cet: Optional[float] = None
    minimum_payment: Optional[float] = None
    due_day: Optional[int] = None
    closing_day: Optional[int] = None
    remaining_installments: Optional[int] = None
    category_id: Optional[str] = None
    contract_file_path: Optional[str] = None
    amortization_system: Optional[AmortizationSystem] = None
    is_subsidized: Optional[bool] = None
    
    card_brand: Optional[CardBrand] = None
    card_limit: Optional[float] = None
    contract_number: Optional[str] = None
    allow_early_amortization: Optional[bool] = None
    indexer: Optional[IndexerType] = None
    insurance_value: Optional[float] = None
    administration_fee: Optional[float] = None
    property_value: Optional[float] = None
    current_property_value: Optional[float] = None
    fgts_usage_interval: Optional[int] = None
    is_under_construction: Optional[bool] = None
    construction_end_date: Optional[date] = None
    total_installments: Optional[int] = None
    installments_paid: Optional[int] = None
    subsidy_amount: Optional[float] = None
    subsidy_expiration_date: Optional[date] = None
    daily_interest_rate: Optional[float] = None
    days_used_in_month: Optional[int] = None
    last_fgts_usage_date: Optional[date] = None
    estimated_fgts_balance: Optional[float] = None
    report: Optional[str] = None

    # --- New Fields for Update ---
    vehicle_brand: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_year: Optional[int] = None
    vehicle_plate: Optional[str] = None
    vehicle_renavam: Optional[str] = None
    gravame_registered: Optional[bool] = None
    vehicle_insurance_active: Optional[bool] = None
    vehicle_insurance_expiry: Optional[date] = None
    ipva_paid: Optional[bool] = None
    licensing_ok: Optional[bool] = None
    card_current_bill: Optional[float] = None
    card_closing_date: Optional[date] = None
    card_minimum_payment_pct: Optional[float] = None
    months_in_revolving: Optional[int] = None
    purchase_description: Optional[str] = None
    purchase_date: Optional[date] = None
    has_interest: Optional[bool] = None
    overdraft_limit: Optional[float] = None
    overdraft_used: Optional[float] = None
    overdraft_days_used: Optional[int] = None
    overdraft_start_date: Optional[date] = None
    consigned_type: Optional[str] = None
    payroll_org: Optional[str] = None
    consigned_margin_used: Optional[float] = None
    consigned_years_committed: Optional[int] = None
    consigned_end_year: Optional[int] = None
    blocks_fgts_withdrawal: Optional[bool] = None

class Debt(DebtBase):
    id: str
    user_id: str
    created_at: Optional[str] = None

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
    has_default_warning: bool = False
    has_negative_amortization_warning: bool = False
    warnings: List[str] = []
