export interface CreditCard {
    id: string;
    name: string;
    brand: 'visa' | 'mastercard' | 'elo' | 'amex' | 'hipercard' | 'other';
    limit: number;
    closing_day: number;
    invoice_due_day: number;
    color: string;
}

export interface Account {
     id?: string;
     name: string;
     type: 'checking' | 'savings' | 'investment' | 'cash' | 'credit_card' | 'other';
     balance: number;
     icon?: string;
     color: string;
     credit_cards?: CreditCard[];
}  