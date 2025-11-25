from app.core.database import get_db
from app.schemas.dashboard import DashboardSummary, CategoryTotal, BudgetSummary
from app.services import category as category_service
from app.services import budget as budget_service
from app.core.date_utils import get_month_range
from typing import Optional

def get_dashboard_data(user_id: str, month: Optional[int] = None, year: Optional[int] = None) -> DashboardSummary:
    db = get_db()
    
    # 1. Saldo Total (Apenas contas do usuário)
    accounts = db.collection("accounts").where("user_id", "==", user_id).stream()
    total_balance = sum(acc.to_dict().get("balance", 0) for acc in accounts)
    
    # 2. Transações (Apenas do usuário)
    transactions_query = db.collection("transactions").where("user_id", "==", user_id)
    all_transactions = transactions_query.stream()

    transactions = []
    if month and year:
        start_date, end_date = get_month_range(month, year)
        for t in all_transactions:
            t_data = t.to_dict()
            transaction_date = t_data.get("date")
            if transaction_date and start_date <= transaction_date <= end_date:
                transactions.append(t)
    else:
        # Se não houver mês e ano, pega todas as transações (embora o ideal seja limitar)
        transactions = list(all_transactions)
    
    income = 0.0
    expense = 0.0
    category_map = {}

    for doc in transactions:
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
            
    # 3. Orçamentos (Budgets)
    budgets_with_spent = budget_service.list_budgets_with_progress(user_id, month, year)

    return DashboardSummary(
        total_balance=total_balance,
        income_month=income,
        expense_month=expense,
        expenses_by_category=categories_list,
        budgets=budgets_with_spent
    )