export type TransactionType = 'expense' | 'income';

export interface Category {
     id?: string;
     name: string;
     icon: string;
     color: string;
     is_custom: boolean;
}

export interface Transaction {
     id: string;
     description: string;
     amount: number;
     date: string;
     type: TransactionType;
     category: Category;
     category_id: string;
}