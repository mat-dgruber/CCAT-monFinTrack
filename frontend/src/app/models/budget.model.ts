import { Category } from './category.model';

export interface Budget {
    id?: string;
    category_id: string;
    category?: Category; // O backend preenche isso
    amount: number;      // O Limite (Meta)
    
    // Campos calculados pelo Backend
    spent?: number;
    percentage?: number;
    is_over_budget?: boolean;
}