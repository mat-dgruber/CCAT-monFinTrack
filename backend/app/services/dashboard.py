from app.core.database import get_db
from app.schemas.dashboard import DashboardSummary, CategoryTotal
from app.services import category as category_service
from app.services import budget as budget_service
from app.core.date_utils import get_month_range
from typing import Optional, List
from datetime import datetime

def get_dashboard_data(
    user_id: str,
    month: Optional[int] = None,
    year: Optional[int] = None,
    accounts: Optional[List[str]] = None,
    payment_methods: Optional[List[str]] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> DashboardSummary:
    db = get_db()
    
    # 1. Saldo Total (Apenas contas do usuário) - Não é afetado pelos filtros
    all_user_accounts = db.collection("accounts").where("user_id", "==", user_id).stream()
    total_balance = sum(acc.to_dict().get("balance", 0) for acc in all_user_accounts)

    # 2. Transações (Apenas do usuário)
    transactions_query = db.collection("transactions").where("user_id", "==", user_id)
    all_transactions = list(transactions_query.stream())

    # Filtros aplicados em memória devido às limitações do Firestore
    
    # Filtro por data
    if start_date and end_date:
        # Se um range específico for fornecido, ignora month/year
        all_transactions = [t for t in all_transactions if start_date <= t.to_dict().get("date") <= end_date]
    elif month and year:
        # Se não, usa month/year
        start, end = get_month_range(month, year)
        all_transactions = [t for t in all_transactions if start <= t.to_dict().get("date") <= end]

    # Filtro por contas
    if accounts:
        all_transactions = [t for t in all_transactions if t.to_dict().get("account_id") in accounts]

    # Filtro por forma de pagamento
    if payment_methods:
        all_transactions = [t for t in all_transactions if t.to_dict().get("payment_method") in payment_methods]
        
    income = 0.0
    expense = 0.0
    category_map = {}

    for doc in all_transactions:
        data = doc.to_dict()
        amount = data.get("amount", 0)
        t_type = data.get("type")
        cat_id = data.get("category_id")

        if t_type == "income":
            income += amount
        elif t_type == "expense":
            expense += amount
            if cat_id in category_map:
                category_map[cat_id] += amount
            else:
                category_map[cat_id] = amount

    categories_list = []
    for cat_id, total in category_map.items():
        cat_obj = category_service.get_category(cat_id)
        if cat_obj:
            categories_list.append(CategoryTotal(
                category_name=cat_obj.name,
                color=cat_obj.color,
                total=total
            ))
            
    # 3. Orçamentos (Budgets) - Progresso do orçamento continua baseado no mês/ano geral
    budgets_with_spent = budget_service.list_budgets_with_progress(user_id, month, year)

    return DashboardSummary(
        total_balance=total_balance,
        income_month=income,
        expense_month=expense,
        expenses_by_category=categories_list,
        budgets=budgets_with_spent
    )