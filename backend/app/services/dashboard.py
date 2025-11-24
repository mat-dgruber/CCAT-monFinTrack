from app.core.database import get_db
from app.schemas.dashboard import DashboardSummary, CategoryTotal
from app.services import category as category_service
from datetime import datetime

def get_dashboard_data() -> DashboardSummary:
    db = get_db()
    
    # 1. Calcular Saldo Total (Soma de todas as contas)
    # CORREÇÃO: collection no singular!
    accounts = db.collection("accounts").stream() 
    
    total_balance = sum(acc.to_dict().get("balance", 0) for acc in accounts)
    
    # 2. Pegar transações
    # CORREÇÃO: collection no singular!
    transactions = db.collection("transactions").stream()
    
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

    # 3. Montar dados do Gráfico
    categories_list = []
    for cat_id, total in category_map.items():
        cat_obj = category_service.get_category(cat_id)
        if cat_obj:
            categories_list.append(CategoryTotal(
                category_name=cat_obj.name,
                color=cat_obj.color,
                total=total
            ))

    return DashboardSummary(
        total_balance=total_balance,
        income_month=income,
        expense_month=expense,
        expenses_by_category=categories_list
    )