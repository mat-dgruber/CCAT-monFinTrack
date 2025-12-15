from typing import List, Optional
from datetime import datetime, date, timedelta
from app.schemas.invoice import InvoiceSummary, InvoiceStatus
from app.services import transaction as transaction_service
from app.services import account as account_service
from app.schemas.transaction import TransactionCreate, TransactionType, PaymentMethod, TransactionStatus
from app.core.database import get_db
from fastapi import HTTPException

# REQUER: pip install python-dateutil
import calendar

def get_invoices(user_id: str) -> List[InvoiceSummary]:
    """
    Calcula dinamicamente todas as faturas para todos os cartões do usuário.
    Baseado nas transações com 'credit_card_id' e datas de fechamento.
    """
    accounts = account_service.list_accounts(user_id)
    invoices = []
    
    # 1. Mapear Contas e Cartões
    cards_map = {}
    for acc in accounts:
        if acc.credit_cards:
            for card in acc.credit_cards:
                cards_map[card.id] = {
                   "card": card, 
                   "account": acc 
                }
    
    if not cards_map:
        return []

    # 2. Buscar Transações
    all_transactions = transaction_service.list_transactions(user_id, limit=2000) 
    card_transactions = [t for t in all_transactions if t.credit_card_id in cards_map]

    # 3. Agrupar por Cartão e Mês de Referência
    # Chave: (card_id, month, year) -> total
    invoice_buckets = {}
    
    for t in card_transactions:
        card_data = cards_map[t.credit_card_id]
        card = card_data["card"]
        
        t_date = t.date
        if isinstance(t_date, datetime):
            t_date = t_date.date()
            
        ref_month = t_date.month
        ref_year = t_date.year
        
        if t_date.day >= card.closing_day:
            # Próximo mês
            if ref_month == 12:
                ref_month = 1
                ref_year += 1
            else:
                ref_month += 1
                
        key = (t.credit_card_id, ref_month, ref_year)
        
        if key not in invoice_buckets:
            invoice_buckets[key] = {
                "amount": 0.0,
                "card": card,
                "account": card_data["account"]
            }
            
        if t.type == TransactionType.EXPENSE:
            invoice_buckets[key]["amount"] += t.amount
        else:
            invoice_buckets[key]["amount"] -= t.amount

    # 4. Construir Objetos InvoiceSummary
    today = date.today()
    
    for (card_id, month, year), data in invoice_buckets.items():
        card = data["card"]
        amount = data["amount"]
        
        # if amount <= 0: continue # Opcional: ocultar faturas zeradas

        # Calcular Vencimento
        try:
            due_date = date(year, month, card.invoice_due_day)
        except ValueError:
            last_day = calendar.monthrange(year, month)[1]
            due_date = date(year, month, last_day)

        # Calcular Fechamento (Visual)
        # Se Closing > Due, fechamento é mês anterior. Se não, mesmo mês.
        acc_closing_month = month
        acc_closing_year = year
        
        if card.closing_day > card.invoice_due_day:
            if acc_closing_month == 1:
                acc_closing_month = 12
                acc_closing_year -= 1
            else:
                acc_closing_month -= 1
        
        try:
            closing_date = date(acc_closing_year, acc_closing_month, card.closing_day)
        except ValueError:
             last_day = calendar.monthrange(acc_closing_year, acc_closing_month)[1]
             closing_date = date(acc_closing_year, acc_closing_month, last_day)
             
        status = InvoiceStatus.OPEN
        if today > due_date:
            status = InvoiceStatus.OVERDUE
        elif today >= closing_date:
            status = InvoiceStatus.CLOSED
        
        invoices.append(InvoiceSummary(
            account_id=data["account"].id,
            credit_card_id=card_id,
            month=month,
            year=year,
            amount=amount,
            status=status,
            due_date=due_date,
            closing_date=closing_date,
            card_name=card.name,
            card_brand=card.brand,
            card_color=card.color,
            card_limit=card.limit
        ))
        
    return invoices

def pay_invoice(user_id: str, invoice_data: dict):
    """
    Registra o pagamento de uma fatura.
    invoice_data: { credit_card_id, amount, source_account_id, payment_date, description }
    """
    credit_card_id = invoice_data.get('credit_card_id')
    amount = invoice_data.get('amount')
    source_account_id = invoice_data.get('source_account_id')
    date_str = invoice_data.get('payment_date')
    description = invoice_data.get('description', f"Pagamento Fatura Cartão")
    
    if not source_account_id:
        raise HTTPException(status_code=400, detail="Conta de origem (source_account_id) obrigatória")
        
    payment_date = datetime.now()
    if date_str:
        try:
             payment_date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        except:
             pass

    # Tenta achar categoria adequada
    cats = transaction_service.category_service.list_categories(user_id)
    category_id = None
    for c in cats:
        # Tenta achar algo como "Pagamento", "Fatura", "Financeiro"
        name_lower = c.name.lower()
        if "fatura" in name_lower or "cartão" in name_lower or "pagamento" in name_lower:
            category_id = c.id
            break
    
    if not category_id and cats:
        category_id = cats[0].id # Fallback
        
    if not category_id:
         raise HTTPException(status_code=400, detail="Nenhuma categoria disponível.")

    t_create = TransactionCreate(
        title=description,
        amount=amount,
        type=TransactionType.EXPENSE,
        category_id=category_id,
        account_id=source_account_id,
        payment_method=PaymentMethod.BANK_TRANSFER, 
        status=TransactionStatus.PAID,
        date=payment_date,
        description=f"Pagamento Ref: Cartão {credit_card_id}"
    )
    
    return transaction_service.create_transaction(t_create, user_id)
