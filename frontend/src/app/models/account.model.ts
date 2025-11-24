export interface Account {
     id?: string;
     name: string;
     type: 'checking' | 'savings' | 'investment' | 'cash' | 'credit_card' | 'other';
     balance: number;
     color?: string;
}