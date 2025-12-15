export interface InvoiceSummary {
    account_id: string;
    credit_card_id: string;
    month: number;
    year: number;
    amount: number;
    status: 'open' | 'closed' | 'paid' | 'overdue';
    due_date: string; // ISO date
    closing_date: string; // ISO date
    
    // Metadados visuais
    card_name: string;
    card_brand: string;
    card_color: string;
    card_limit?: number;
}

export interface PayInvoicePayload {
    credit_card_id: string;
    amount: number;
    source_account_id: string;
    description: string;
    payment_date: string; // ISO
    month: number;
    year: number;
}
