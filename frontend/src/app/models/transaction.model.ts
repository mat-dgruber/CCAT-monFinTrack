import { Account } from './account.model';
import { Category, CategoryType } from './category.model';

export type TransactionType = CategoryType;

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: Date; // ou string, dependendo de como vem do back
  type: 'expense' | 'income';
  category: Category;
  account: Account;
  payment_method: string;
  status?: 'paid' | 'pending';
  payment_date?: Date;
  
  // Novos campos
  installment_group_id?: string;
  installment_number?: number;
  total_installments?: number;
  
  recurrence_id?: string;
  is_recurrence?: boolean;
  recurrence_periodicity?: string;

  category_id?: string;
  account_id?: string;
}