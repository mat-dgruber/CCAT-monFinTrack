import { Account } from './account.model';
import { Category, CategoryType } from './category.model';

export type TransactionType = CategoryType;

export interface Transaction {
  id: string;
  title: string;
  description?: string;
  amount: number;
  date: Date; // ou string, dependendo de como vem do back
  type: 'expense' | 'income' | 'transfer';
  category: Category;
  account: Account;
  payment_method: string;
  status?: 'paid' | 'pending';
  payment_date?: Date;
  dateGroup?: string;
  isNewYear?: boolean;
  isNewMonth?: boolean;
  yearLabel?: string;
  monthLabel?: string;
  recurrence_id?: string;
  is_recurrence?: boolean;
  recurrence_periodicity?: string;
  total_installments?: number;
  current_installment?: number;
  installment_id?: string;
  installment_group_id?: string;
  category_id?: string;
  is_auto_pay?: boolean;
  tithe_amount?: number;
  tithe_percentage?: number;
  offering_amount?: number;
  offering_percentage?: number;
  net_amount?: number;
  tithe_status?: 'NONE' | 'PENDING' | 'PAID';
  gross_amount?: number;
  credit_card_id?: string;
  attachments?: string[];
}
