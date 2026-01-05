export interface SeasonalIncome {
    id: string;
    name: string;
    amount: number;
    receive_date: Date | string;
    is_recurrence: boolean;
    description?: string;
    user_id: string;
}

export interface SeasonalIncomeCreate {
    name: string;
    amount: number;
    receive_date: Date | string;
    is_recurrence: boolean;
    description?: string;
}
