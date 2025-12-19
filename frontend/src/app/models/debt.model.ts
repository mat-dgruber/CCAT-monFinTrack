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

export interface Debt {
  id: string;
  user_id: string;
  name: string;
  debt_type: DebtType;
  total_amount: number;
  original_amount?: number;
  interest_rate: number;
  interest_period: InterestPeriod;
  cet?: number;
  minimum_payment?: number;
  due_day?: number;
  remaining_installments?: number;
  category_id?: number | string; // Assuming string based on backend, but flexible
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
