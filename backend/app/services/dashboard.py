from app.core.database import get_db
from app.schemas.dashboard import DashboardSummary, CategoryTotal
from app.schemas.budget import Budget
from app.services import category as category_service
from app.services import budget as budget_service

def get_dashboard_data(user_id: str) -> DashboardSummary:
    db = get_db()
    
    # 1. Saldo Total (Apenas contas do usuário)
    accounts = db.collection("accounts").where("user_id", "==", user_id).stream()
    total_balance = sum(acc.to_dict().get("balance", 0) for acc in accounts)
    
    # 2. Transações (Apenas do usuário)
    transactions = list(db.collection("transactions").where("user_id", "==", user_id).stream())
    
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
    user_budgets = budget_service.list_budgets(user_id)
    budgets_with_spent = []
    for budget_data in user_budgets:
        budget = Budget(**budget_data)
        spent = sum(
            t.to_dict().get("amount", 0)
            for t in transactions
            if t.to_dict().get("category_id") == budget.category_id and t.to_dict().get("type") == "expense"
        )
        budget.spent = spent
        budgets_with_spent.append(budget)


    return DashboardSummary(
        total_balance=total_balance,
        income_month=income,
        expense_month=expense,
        expenses_by_category=categories_list,
        budgets=budgets_with_spent
    )