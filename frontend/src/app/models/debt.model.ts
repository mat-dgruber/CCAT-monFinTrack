export enum DebtType {
  CREDIT_CARD_ROTATING = 'credit_card_rotating',
  CREDIT_CARD_INSTALLMENT = 'credit_card_installment',
  OVERDRAFT = 'overdraft',
  PERSONAL_LOAN = 'personal_loan',
  CONSIGNED_CREDIT = 'consigned_credit',
  VEHICLE_FINANCING = 'vehicle_financing',
  REAL_ESTATE_FINANCING = 'real_estate_financing',
  LOAN = 'loan',
  FINANCING = 'financing',
  OTHER = 'other',
}

export enum InterestPeriod {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export enum AmortizationSystem {
  SAC = 'sac',
  PRICE = 'price',
  NONE = 'none',
}

export enum DebtStatus {
  ON_TIME = 'on_time',
  OVERDUE = 'overdue',
  LATE = 'late',
  NEGOTIATION = 'negotiation',
}

export enum CardBrand {
  MASTERCARD = 'mastercard',
  VISA = 'visa',
  AMEX = 'amex',
  ELO = 'elo',
  HIPERCARD = 'hipercard',
  OTHER = 'other',
}

export enum IndexerType {
  TR = 'tr',
  IPCA = 'ipca',
  POUPANCA = 'poupanca',
  CDI = 'cdi',
  IGPM = 'igpm',
  NONE = 'none',
}

export interface Debt {
  id: string;
  user_id: string;
  name: string;
  debt_type: DebtType;
  status: DebtStatus; // New field

  total_amount: number;
  original_amount?: number;
  interest_rate: number;
  interest_period: InterestPeriod;
  cet?: number;

  minimum_payment?: number;
  due_day?: number;
  closing_day?: number; // New field

  remaining_installments?: number;
  category_id?: number | string;

  // Specific Fields
  card_brand?: CardBrand;
  card_limit?: number;

  contract_number?: string;
  allow_early_amortization?: boolean;

  indexer?: IndexerType;
  insurance_value?: number;
  administration_fee?: number;
  property_value?: number;
  current_property_value?: number;
  fgts_usage_interval?: number;
  last_fgts_usage_date?: Date | string;
  estimated_fgts_balance?: number;

  is_under_construction?: boolean;
  construction_end_date?: Date | string;

  total_installments?: number;
  installments_paid?: number;

  subsidy_amount?: number;
  subsidy_expiration_date?: Date | string;

  daily_interest_rate?: number;
  days_used_in_month?: number;

  contract_file_path?: string;
  amortization_system?: AmortizationSystem;
  is_subsidized?: boolean;
  report?: string;

  // Universal Fields
  creditor_institution?: string;
  contract_date?: Date | string;
  next_due_date?: Date | string;
  observations?: string;

  // Financiamento Veículo
  vehicle_brand?: string;
  vehicle_model?: string;
  vehicle_year?: number;
  vehicle_plate?: string;
  vehicle_renavam?: string;
  vehicle_chassi?: string;
  down_payment?: number;
  gravame_registered?: boolean;
  vehicle_insurance_active?: boolean;
  vehicle_insurance_expiry?: Date | string;
  ipva_paid?: boolean;
  licensing_ok?: boolean;

  // Cartão
  card_current_bill?: number;
  card_closing_date?: Date | string;
  card_minimum_payment_pct?: number;
  months_in_revolving?: number;

  // Cartão Parcelado
  purchase_description?: string;
  purchase_date?: Date | string;
  has_interest?: boolean;

  // Cheque Especial
  overdraft_limit?: number;
  overdraft_used?: number;
  overdraft_days_used?: number;
  overdraft_start_date?: Date | string;

  // Consignado
  consigned_type?: 'inss' | 'servidor_publico' | 'clt' | 'fgts_aniversario';
  payroll_org?: string;
  consigned_margin_used?: number;
  consigned_years_committed?: number;
  consigned_end_year?: number;
  blocks_fgts_withdrawal?: boolean;

  stats?: DebtStats;
}

export interface DebtStats {
  priority_score: number;
  priority_label: string;
  total_interest_remaining: number;
  months_remaining: number;
  monthly_rate: number;
}

export interface PaymentStep {
  month_index: number;
  date: string;
  payment_amount: number;
  interest_paid: number;
  principal_paid: number;
  remaining_balance: number;
  debt_id: string;
  debt_name: string;
}

export interface DebtPayoffSummary {
  debt_id: string;
  debt_name: string;
  total_interest_paid: number;
  payoff_months: number;
  payoff_date: string;
}

export interface PaymentPlan {
  strategy: 'snowball' | 'avalanche';
  monthly_budget: number;
  total_interest_paid: number;
  total_months: number;
  payoff_date: string;
  steps: PaymentStep[];
  debt_summaries: DebtPayoffSummary[];
  has_default_warning?: boolean;
  has_negative_amortization_warning?: boolean;
  warnings?: string[];
}
