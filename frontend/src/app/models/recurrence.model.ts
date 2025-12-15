export enum RecurrencePeriodicity {
    MONTHLY = 'monthly',
    WEEKLY = 'weekly',
    YEARLY = 'yearly'
}

export interface Recurrence {
    id: string;
    user_id: string;
    name: string;
    amount: number;
    category_id: string;
    account_id: string;
    payment_method_id?: string;
    credit_card_id?: string;
    periodicity: string;
    auto_pay: boolean;
    due_day: number;
    due_month?: number;
    active: boolean;
    created_at: Date;
    last_processed_at?: Date;
    cancellation_date?: Date;
    skipped_dates?: string[];
    type?: 'expense' | 'income' | 'transfer';
}
