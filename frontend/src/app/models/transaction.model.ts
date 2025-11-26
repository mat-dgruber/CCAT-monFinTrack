import { Account } from './account.model';
import { Category, CategoryType } from './category.model';

export type TransactionType = CategoryType;

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