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
        
    transactions_query = db.collection("transactions").where("user_id", "==", user_id)
    
    # DETERMINE O RANGE TOTAL NECESSÁRIO (Mês Atual + 6 Meses de Evolução)
    # Start: O menor entre (current_start) e (6 meses atrás)
    # End: O maior entre (current_end) e (hoje - caso futuro?)
    
    # 6 Months ago from ref_date
    evolution_start = ref_date - timedelta(days=200) # Safe buffer
    
    # Normalize Timezones
    if evolution_start.tzinfo is None: evolution_start = evolution_start.replace(tzinfo=timezone.utc)
    if current_start.tzinfo is None: current_start = current_start.replace(tzinfo=timezone.utc)
    if current_end.tzinfo is None: current_end = current_end.replace(tzinfo=timezone.utc)
    
    query_start = min(current_start, evolution_start)
    query_end = current_end
    
    # Ensure optimized query
    # Using transaction_service to leverage the logic we just fixed
    # list_transactions returns Pydantic models. We convert to dicts to maintain compatibility with below logic.
    from app.services import transaction as transaction_service
    
    pydantic_txs = transaction_service.list_transactions(
        user_id=user_id,
        start_date=query_start,
        end_date=query_end,
        limit=2000 # 6 months * ~300 tx/mo = 1800. Safe cap.
    )
    
    all_transactions_data = [t.model_dump() for t in pydantic_txs]

    # Fetch Invoice Category ID once
    invoice_category_id = None
    # We must search for it. It's better to cache this or query once per request.
    # Since this is "dashboard", one extra query is fine.
    # Note: Using stream() on query object, not db
    inv_query = db.collection("categories").where("name", "==", "Fatura Cartão").limit(1).stream()
    for doc in inv_query:
        invoice_category_id = doc.id
        break

    # Filtrar para o Dashboard Principal (Mês Selecionado)
    # Helper para comparar datas naive/aware de forma segura
    def is_in_range(date_val, start, end):
        if not date_val: return False
        # Se date_val tem tz e start/end não (ou vice versa), crash.
        # Vamos normalizar tudo para UTC se possível ou remover TZ.
        # Melhor abordagem: Firestore retorna Aware (UTC). Nossas Ranges são Aware (UTC).
        # Se date_val for Naive (ex: dados antigos bugados), assumir UTC.
        d = date_val
        if isinstance(d, str):
            try:
                d = datetime.fromisoformat(d.replace("Z", "+00:00"))
            except ValueError:
                return False

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
        # Check exclusion for Invoice
        if invoice_category_id and data.get("category_id") == invoice_category_id:
            continue

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
                # EXCLUSÃO: Ignorar Fatura Cartão
                # Precisamos pegar o nome da categoria. Como não temos o objeto categoria aqui fácil (só ID),
                # vamos assumir que a Fatura Cartão tem um ID específico ou precisamos buscar.
                # Mas fazer get_category n vezes é lento.
                # Melhora: A Fatura Cartão é criada pelo sistema.
                # O ideal é filtrar tudo que tiver "Fatura Cartão" no nome da Categoria SE tivermos o nome aqui.
                # No `all_transactions_data` (linha 46), temos o dict do firestore.
                # O firestore NÃO traz o nome da categoria junto, só o ID.
                # Mas no começo do `dashboard.py` podemos pegar o ID da Fatura Cartão.
                
                # Para performance, vamos pegar o ID da Fatura Cartão uma vez só fora do loop.
                # (Vou inserir essa busca antes dos loops)
                
                # Check exclusion based on cached ID (passed via closure/local var)
                # Assuming `invoice_category_id` is defined above.
                if t.get("category_id") == invoice_category_id:
                     continue

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