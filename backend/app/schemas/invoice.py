from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, date

class InvoiceStatus(str):
    OPEN = "open"       # Fatura Aberta (Antes do fechamento)
    CLOSED = "closed"   # Fatura Fechada (Entre fechamento e vencimento)
    PAID = "paid"       # Fatura Paga 
    OVERDUE = "overdue" # Fatura Atrasada

class InvoiceSummary(BaseModel):
    account_id: str
    credit_card_id: str
    month: int
    year: int
    amount: float
    status: str
    due_date: date
    closing_date: date
    
    # Metadados visuais
    card_name: str
    card_brand: str
    card_color: str
    card_limit: Optional[float] = None
