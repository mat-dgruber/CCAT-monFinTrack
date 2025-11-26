from app.core.database import get_db
from app.schemas.dashboard import DashboardSummary, CategoryTotal, MonthlyEvolution
from app.services import category as category_service
from app.services import budget as budget_service
from app.core.date_utils import get_month_range
from typing import Optional, List
from datetime import datetime, timedelta, timezone
import calendar

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

    # --- DADOS DO MÊS ATUAL (PRINCIPAL) ---
    
    # Definir range do mês atual (ou selecionado)
    if start_date and end_date:
        # Ensure provided dates are aware or handle comparison carefully. 
        # Assuming incoming are naive or aware, we should standardize if needed.
        # But standard practice: if input is naive, assume local or UTC? 
        # Let's assume they match the DB (UTC).
        current_start, current_end = start_date, end_date
        ref_date = end_date
    elif month and year:
        current_start, current_end = get_month_range(month, year)
        ref_date = datetime(year, month, 1, tzinfo=timezone.utc)
    else:
        now = datetime.now(timezone.utc)
        current_start, current_end = get_month_range(now.month, now.year)
        ref_date = now
        
    # Query Principal (Todas do usuário, filtra em memória)
    transactions_query = db.collection("transactions").where("user_id", "==", user_id)
    all_transactions_stream = list(transactions_query.stream())
    all_transactions_data = [doc.to_dict() for doc in all_transactions_stream] # Cache in memory

    # Filtrar para o Dashboard Principal (Mês Selecionado)
    # Helper para comparar datas naive/aware de forma segura
    def is_in_range(date_val, start, end):
        if not date_val: return False
        # Se date_val tem tz e start/end não (ou vice versa), crash.
        # Vamos normalizar tudo para UTC se possível ou remover TZ.
        # Melhor abordagem: Firestore retorna Aware (UTC). Nossas Ranges são Aware (UTC).
        # Se date_val for Naive (ex: dados antigos bugados), assumir UTC.
        d = date_val
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        
        # start/end devem ser aware pois get_month_range retorna aware.
        # Se start_date/end_date args vierem naive, precisamos tratar.
        s, e = start, end
        if s.tzinfo is None: s = s.replace(tzinfo=timezone.utc)
        if e.tzinfo is None: e = e.replace(tzinfo=timezone.utc)
            
        return s <= d <= e

    current_transactions = [
        t for t in all_transactions_data 
        if is_in_range(t.get("date"), current_start, current_end)
    ]

    # Filtro por contas (Principal)
    if accounts:
        current_transactions = [t for t in current_transactions if t.get("account_id") in accounts]

    # Filtro por forma de pagamento (Principal)
    if payment_methods:
        current_transactions = [t for t in current_transactions if t.get("payment_method") in payment_methods]
        
    income = 0.0
    expense = 0.0
    category_map = {}

    for data in current_transactions:
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

    # --- 4. EVOLUÇÃO MENSAL (ÚLTIMOS 6 MESES) ---
    
    evolution_data = []
    
    # Gerar lista de datas para os últimos 6 meses
    months_to_fetch = []
    curr = ref_date
    for _ in range(6):
        months_to_fetch.append((curr.month, curr.year))
        # Voltar um mês
        first = curr.replace(day=1)
        prev_month = first - timedelta(days=1)
        curr = prev_month
    
    months_to_fetch.reverse() # Ordem cronológica
    
    for m, y in months_to_fetch:
        m_start, m_end = get_month_range(m, y)
        label = f"{m:02d}/{str(y)[-2:]}" # ex: 11/25
        
        m_income = 0.0
        m_expense = 0.0
        
        for t in all_transactions_data:
            # Filtros Globais
            if accounts and t.get("account_id") not in accounts:
                continue
            if payment_methods and t.get("payment_method") not in payment_methods:
                continue
                
            if is_in_range(t.get("date"), m_start, m_end):
                val = t.get("amount", 0)
                tp = t.get("type")
                if tp == "income": m_income += val
                elif tp == "expense": m_expense += val
        
        evolution_data.append(MonthlyEvolution(
            month=label,
            income=m_income,
            expense=m_expense
        ))

    return DashboardSummary(
        total_balance=total_balance,
        income_month=income,
        expense_month=expense,
        expenses_by_category=categories_list,
        budgets=budgets_with_spent,
        evolution=evolution_data
    )