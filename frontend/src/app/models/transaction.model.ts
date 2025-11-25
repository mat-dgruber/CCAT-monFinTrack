import { Account } from './account.model';

export type TransactionType = 'expense' | 'income';

export interface Category {
     id?: string;
     name: string;
     icon: string;
     color: string;
     is_custom: boolean;
     type: TransactionType;
}

export interface Transaction {
     id: string;
     description: string;
     amount: number;
     date: string;
     payment_method: string;
     type: TransactionType;
     category: Category;
     account: Account
     category_id?: string;
     account_id?: string;
}