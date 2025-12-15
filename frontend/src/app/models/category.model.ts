export type CategoryType = 'expense' | 'income' | 'transfer';

export interface Category {
     id?: string;
     name: string;
     icon: string;
     color: string;
     is_custom: boolean;
     type: CategoryType;
     parent_id?: string;
     subcategories?: Category[];
}
