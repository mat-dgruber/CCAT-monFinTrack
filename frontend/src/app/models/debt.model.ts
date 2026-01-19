export enum DebtType {
  CREDIT_CARD_ROTATING = 'credit_card_rotating',
  CREDIT_CARD_INSTALLMENT = 'credit_card_installment',
  OVERDRAFT = 'overdraft',
  PERSONAL_LOAN = 'personal_loan',
  CONSIGNED_CREDIT = 'consigned_credit',
  VEHICLE_FINANCING = 'vehicle_financing',
  REAL_ESTATE_FINANCING = 'real_estate_financing',
  OTHER = 'other'
}

export enum InterestPeriod {
  MONTHLY = 'monthly',
  YEARLY = 'yearly'
}

export enum AmortizationSystem {
  SAC = 'sac',
  PRICE = 'price',
  NONE = 'none'
}

export enum DebtStatus {
  ON_TIME = 'on_time',
  OVERDUE = 'overdue',
  NEGOTIATION = 'negotiation'
}

export enum CardBrand {
  MASTERCARD = 'mastercard',
  VISA = 'visa',
  AMEX = 'amex',
  ELO = 'elo',
  HIPERCARD = 'hipercard',
  OTHER = 'other'
}

export enum IndexerType {
  TR = 'tr',
  IPCA = 'ipca',
  POUPANCA = 'poupanca',
  CDI = 'cdi',
  IGPM = 'igpm',
  NONE = 'none'
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
  property_value?: number;
  current_property_value?: number;
  fgts_usage_interval?: number;

  daily_interest_rate?: number;
  days_used_in_month?: number;

  contract_file_path?: string;
  amortization_system?: AmortizationSystem;
  is_subsidized?: boolean;
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
}
