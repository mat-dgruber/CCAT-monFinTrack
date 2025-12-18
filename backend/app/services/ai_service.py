import google.generativeai as genai
import os
import hashlib
from app.core.database import get_db
from typing import List, Optional
from app.schemas.category import Category
from app.services import category as category_service
from app.services import account as account_service
from app.services import transaction as transaction_service
from datetime import datetime, timedelta
import json

# Configura a API Key e Modelo (carregados do .env)
GENAI_API_KEY = os.getenv("GOOGLE_API_KEY")
AI_MODEL_NAME = os.getenv("GOOGLE_AI_MODEL", "gemini-2.0-flash-lite")

if GENAI_API_KEY:
    genai.configure(api_key=GENAI_API_KEY)
else:
    print("⚠️ GOOGLE_API_KEY not found. AI features will be disabled.")

def classify_transaction(description: str, user_id: str) -> Optional[str]:
    """
    Usa o Gemini Flash para classificar uma transação com base na descrição.
    Retorna o ID da categoria sugerida.
    """
    if not GENAI_API_KEY:
        return None

    try:
        # 0. CACHE check (Cost Savings!)
        # Cria um hash da descrição para usar como chave de cache (normaliza texto)
        desc_clean = description.strip().lower()
        desc_hash = hashlib.md5(desc_clean.encode('utf-8')).hexdigest()
        
        db = get_db()
        cache_ref = db.collection('ai_predictions').document(desc_hash)
        cache_doc = cache_ref.get()
        
        if cache_doc.exists:
            data = cache_doc.to_dict()
            # Se já classificamos isso antes e temos um ID, retorna direto!
            if data.get('category_id'):
                print(f"✨ AI Cache Hit: '{description}' -> {data.get('category_id')}")
                return data.get('category_id')

        # 1. Busca categorias do usuário para dar contexto à IA
        # Trazemos todas (receita e despesa) ou filtramos? 
        # Geralmente categorização é para despesa, mas pode ser receita.
        categories = category_service.list_categories(user_id)
        
        # Formata a lista para o prompt no estilo TOON (Header + Data)
        # C[name,id]
        category_lines = [f"{c.name},{c.id}" for c in categories]
        cat_toon = "C[name,id]\n" + "\n".join(category_lines)
        
        # 2. Busca histórico recente para Few-Shot Learning (Aprender com o usuário)
        # Pega as últimas 50 transações para ver padrões
        history = transaction_service.list_transactions(user_id, limit=50)
        examples = []
        for t in history:
             if t.category and t.title:
                 clean_title = t.title.replace('"', '').strip()
                 examples.append(f'Tx:"{clean_title}" -> CatID:{t.category.id} ({t.category.name})')
        
        # Junta os exemplos em um bloco de texto (exibe apenas os últimos 20 para economizar tokens se necessário, mas 50 cabe no Flash)
        examples_block = "User History (Patterns):\n" + "\n".join(examples[:30]) 

        # 3. Monta o Prompt
        model = genai.GenerativeModel(AI_MODEL_NAME)
        
        prompt = f"""
        Data:TOON(C[name,id])
        {cat_toon}
        
        {examples_block}
        
        Task: Classify current Tx based on Categories AND User History patterns.
        Current Tx:"{description}"
        Return Category ID only or "null".
        """
        
        # 3. Chama a IA
        response = model.generate_content(prompt)
        predicted_id = response.text.strip()
        
        if predicted_id.lower() == "null":
            return None
            
        # Verifica se o ID retornado existe na lista (segurança)
        valid_ids = {c.id for c in categories}
        if predicted_id in valid_ids:
            # 4. SALVA NO CACHE
            cache_ref.set({
                'description': desc_clean,
                'category_id': predicted_id,
                'created_at': datetime.now(),
                'user_id_context': user_id
            })
            return predicted_id
            
        return None

    except Exception as e:
        print(f"❌ Error calling Gemini AI: {e}")
        return None

def chat_finance(message: str, user_id: str, tier: str = 'pro', persona: str = 'friendly') -> str:
    """
    Chatbot financeiro que usa dados do usuário para responder perguntas.
    Persona: 'friendly' (padrão) ou 'roast' (sarcástico/engraçado).
    """
    if tier == 'free':
        return "Upgrade to Pro to chat with AI!"

    if not GENAI_API_KEY:
        return "I'm sorry, my AI brain is currently offline (API Key missing)."

    try:
        # 1. Coletar Contexto (RAG Simplificado)
        
        # A. Saldo das Contas
        accounts = account_service.list_accounts(user_id)
        accounts_info = []
        total_balance = 0
        for acc in accounts:
            accounts_info.append(f"{acc.name}:R${acc.balance:.0f}") # Removed "- " and decimals for tokens
            total_balance += acc.balance
            
        accounts_str = ",".join(accounts_info) # Comma separated is denser
        
        # B. Transações Recentes (Últimas 10 - Reduced from 15)
        transactions = transaction_service.list_transactions(user_id, limit=10)
        tx_info = []
        for t in transactions:
            # TOON Format: T[date,title,category,amount]
            date_str = t.date.strftime("%d/%m")
            cat = t.category.name if t.category else "?"
            safe_title = t.title.replace(",", " ")[:20] # Truncate title to 20 chars
            tx_info.append(f"{date_str},{safe_title},{cat},{t.amount:.0f}")
            
        # C. Agregação por Categoria (Para Contexto Rico e Gráficos)
        # Calcula total por categoria nas últimas transações (ou melhor, no mês atual para ser mais útil)
        # Vamos pegar transações do mês corrente para análise macro
        now = datetime.now()
        start_month = datetime(now.year, now.month, 1)
        txs_month = transaction_service.list_transactions(user_id, start_date=start_month)
        
        cat_totals = {}
        for t in txs_month:
             if t.type == 'expense':
                 c_name = t.category.name if t.category else "Outros"
                 cat_totals[c_name] = cat_totals.get(c_name, 0) + abs(t.amount)
        
        # Top 5 Categorias
        top_cats = dict(sorted(cat_totals.items(), key=lambda x: x[1], reverse=True)[:5])
        agg_context = f"MonthTops:{json.dumps(top_cats, ensure_ascii=False)}"

        # 2. Montar System Prompt
        model = genai.GenerativeModel(AI_MODEL_NAME)
        
        # Highly condensed context
        system_context = f"""
        Ctx:
        Bal:R${total_balance:.0f}
        Accs:{accounts_str}
        LastTx:
        {tx_toon}
        {agg_context}
        
        Q:{message}
        """
        
        if persona == 'roast':
            # PROMPT ROAST
            final_prompt = f"""
            {system_context}
            Role:Sarcastic Advisor.
            Task:Roast user's spending. Answer Q. Be funny/mean. Use emojis. PT-BR.
            """
        else:
            # PROMPT FRIENDLY (Default)
            final_prompt = f"""
            {system_context}
            Role:Financial Assistant.
            
            Rules:
            1. Answer Q based on data. Be concise. PT-BR.
            2. If user asks for a graph/chart/visual:
               - Return valid JSON ONLY for the graph at the end of response.
               - Format:
               ```json
               {{
                 "type": "chart",
                 "chartType": "pie" (or "bar"),
                 "title": "Gastos do Mês",
                 "data": {{ "labels": ["Cat A", "Cat B"], "values": [100, 20] }}
               }}
               ```
               - Use 'MonthTops' data for charts unless specific range requested.
            3. If user wants to ADD/CREATE a transaction (e.g., "Gastei 50 no Uber"):
               - Return valid JSON ONLY for the action.
               - Format:
               ```json
               {{
                 "type": "action",
                 "action": "create_transaction",
                 "data": {{
                   "title": "Uber",
                   "amount": 50.00,
                   "type": "expense",
                   "category_id": "best_match_id",
                   "account_id": "best_match_account_id"
                 }}
               }}
               ```
               - Infer today's date. Default payment method "credit_card" if not specified.
            4. If user asks for a BUDGET/PLAN (e.g., "Crie um orçamento", "Planeje meus gastos"):
               - Return valid JSON ONLY for the action.
               - Format:
               ```json
               {{
                 "type": "action",
                 "action": "generate_budget_plan"
               }}
               ```
            """

        
        # 3. Call AI
        response = model.generate_content(final_prompt)
        text_response = response.text
        
        # 4. Check for Action JSON
        import re
        json_match = re.search(r'```json\s*(\{[\s\S]*?\})\s*```', text_response)
        if json_match:
            try:
                action_data = json.loads(json_match.group(1))
                if action_data.get('type') == 'action' and action_data.get('action') == 'create_transaction':
                    # Execute Action
                    from app.schemas.transaction import TransactionCreate, TransactionType, PaymentMethod, TransactionStatus
                    
                    t_data = action_data['data']
                    
                    # Defaults
                    if not t_data.get('account_id'):
                         # Fallback to first account if AI fails guessing
                         if accounts:
                             t_data['account_id'] = accounts[0].id
                    
                    # Validate Category (or fallback to 'Outros')
                    # For simplicity, we assume AI picks a valid ID from the context list. 
                    # If None, we might fail or pick random. Let's trust AI context for now.
                    
                    new_tx = TransactionCreate(
                        title=t_data['title'],
                        amount=float(t_data['amount']),
                        type=t_data.get('type', 'expense'),
                        category_id=t_data['category_id'],
                        account_id=t_data['account_id'],
                        payment_method=t_data.get('payment_method', 'credit_card'),
                        date=datetime.now(),
                        status='paid'
                    )
                    
                    created = transaction_service.create_transaction(new_tx, user_id)
                    return f"✅ Pronto! Criei a transação '{created.title}' de R$ {created.amount:.2f}."

                elif action_data.get('type') == 'action' and action_data.get('action') == 'generate_budget_plan':
                     return self.generate_budget_plan(user_id)

            except Exception as e:
                print(f"❌ Action Error: {e}")
                return "Tentei processar sua solicitação, mas algo deu errado. 🤖"

        return text_response

    except Exception as e:
        print(f"❌ Error calling Gemini AI Chat: {e}")
        return "Desculpe, erro ao processar. Tente novamente."

def parse_receipt(image_bytes: bytes, mime_type: str, user_id: str, tier: str = 'pro') -> Optional[dict]:
    """
    Analisa uma imagem de comprovante e extrai dados (Data, Valor, Título, Categoria).
    """
    if not GENAI_API_KEY:
        return None

    try:
        # 1. Contexto de Categorias (TOON) e Contas
        categories = category_service.list_categories(user_id)
        category_lines = [f"{c.name},{c.id}" for c in categories]
        cat_toon = "C[name,id]\n" + "\n".join(category_lines)
        
        accounts = account_service.list_accounts(user_id)
        account_lines = [f"{a.name},{a.id}" for a in accounts]
        acc_toon = "A[name,id]\n" + "\n".join(account_lines)

        # 2. Monta Prompt Multimodal
        model = genai.GenerativeModel(AI_MODEL_NAME)
        
        prompt = f"""
        Context:
        {cat_toon}
        {acc_toon}
        
        Task: Extract receipt data (PT-BR).
        
        Output JSON:
        {{
          "title": "Store Name",
          "amount": 0.00 (Total),
          "date": "YYYY-MM-DD",
          "category_id": "best_match_id",
          "payment_method": "credit_card|debit_card|cash|pix",
          "account_id": "best_match_account_based_on_name_payment",
          "location": "Address or City found",
          "items": [
             {{ "description": "Item 1", "amount": 10.00, "category_id": "match_id" }},
             {{ "description": "Item 2", "amount": 20.00, "category_id": "match_id" }}
          ]
        }}
        
        Rules:
        - If date missing, use today.
        - Payment method mapped to: credit_card, debit_card, cash, pix.
        - Guess Account based on store name (e.g. if I pay iFood usually with Nubank) or payment method.
        """
        
        # PRO TIER LIMITATION: No Item extraction, just totals.
        if tier == 'pro':
             prompt += "\nNOTE: Extract ONLY total Amount, Date, Store Name. DO NOT extract items list (return empty items [])."
        
        
        # 3. Cria objeto de imagem para o Gemini
        cookie_picture = {
            'mime_type': mime_type,
            'data': image_bytes
        }
        
        # 4. Chama a IA (Visual)
        response = model.generate_content([prompt, cookie_picture])
        text = response.text.strip()
        
        # Limpa markdown ```json ... ``` se houver
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        
        return json.loads(text)

    except Exception as e:
        print(f"❌ Error parsing receipt: {e}")
        return None

def generate_monthly_report(user_id: str, month: int, year: int, tier: str = 'pro') -> str:
    """
    Gera um relatório qualitativo do mês usando IA.
    """
    if not GENAI_API_KEY:
        return "IA indisponível no momento."

    try:
        # 1. Coleta Dados do Mês Atual
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1) - timedelta(microseconds=1)
        else:
            end_date = datetime(year, month + 1, 1) - timedelta(microseconds=1)
            
        txs_current = transaction_service.list_transactions(user_id, start_date=start_date, end_date=end_date)
        
        total_current = 0
        cat_current = {}
        for t in txs_current:
            if t.type == 'expense':
                val = abs(t.amount)
                total_current += val
                c_name = t.category.name if t.category else "Outros"
                cat_current[c_name] = cat_current.get(c_name, 0) + val
                
        # 2. Coleta Dados do Mês Anterior (para comparação)
        last_month_date = start_date - timedelta(days=1)
        m_prev = last_month_date.month
        y_prev = last_month_date.year
        start_prev = datetime(y_prev, m_prev, 1)
        end_prev = last_month_date
        
        txs_prev = transaction_service.list_transactions(user_id, start_date=start_prev, end_date=end_prev)
        total_prev = 0
        cat_prev = {}
        for t in txs_prev:
            if t.type == 'expense':
                val = abs(t.amount)
                total_prev += val
                c_name = t.category.name if t.category else "Outros"
                cat_prev[c_name] = cat_prev.get(c_name, 0) + val
        
        # 3. Análise Avançada (Forecasting & Outliers)
        now = datetime.now()
        is_current_month = (now.month == month and now.year == year)
        projection_text = "N/A (Closed Month)"
        
        if is_current_month:
            days_passed = now.day
            last_day = end_date.day # end_date is adjusted? Logic above sets end_date to start of next month - 1 microsecond.
            # Fix day extraction
            import calendar
            _, days_in_month = calendar.monthrange(year, month)
            
            daily_avg = total_current / max(1, days_passed)
            projected_total = daily_avg * days_in_month
            projection_text = f"R${projected_total:.2f} (Based on R${daily_avg:.2f}/day)"
        
        # Top 3 Maiores Gastos (Outliers)
        # Assuming txs_current is list of objects
        sorted_txs = sorted([t for t in txs_current if t.type == 'expense'], key=lambda x: x.amount, reverse=True)
        top_txs = []
        for t in sorted_txs[:3]:
             top_txs.append(f"{t.title}: R${t.amount:.0f}")

        # 4. Formata Contexto para IA
        context = f"""
        Current Month ({month}/{year}):
        - Total Spent: R${total_current:.0f}
        - Top 5 Categories: {json.dumps(dict(sorted(cat_current.items(), key=lambda x: x[1], reverse=True)[:5]), ensure_ascii=False)}
        - Largest Expenses: {", ".join(top_txs)}
        - Forecast (if current): {projection_text}
        
        Previous Month ({m_prev}/{y_prev}):
        - Total Spent: R${total_prev:.0f}
        - Top Categories: {json.dumps(dict(sorted(cat_prev.items(), key=lambda x: x[1], reverse=True)[:3]), ensure_ascii=False)}
        """
        
        # 5. Prompt Premium
        model = genai.GenerativeModel(AI_MODEL_NAME)
        prompt = f"""
        Data:
        {context}
        
        Role: Senior Financial Advisor.
        Task: Write a PREMIUM Monthly Report (PT-BR). Markdown format.
        
        Structure:
        1. **Resumo Executivo & Nota**: Start with a Health Score (0-10) and brief summary.
        2. **Análise de Tendência**: Compare with last month. Why did it go up/down?
        3. **Previsão (Forecasting)**: If current month, warn about the projection.
        4. **Vilões do Mês**: Comment on specific categories or large expenses.
        5. **Dica de Ouro**: One specific action to save money next month.
        
        Style: Professional but accessible. Use emojis. Bold key numbers.
        """
        
        if tier == 'pro':
            # SIMPLE REPORT FOR PRO
            prompt = f"""
            Data:
            {context}
            
            Role: Financial Assistant.
            Task: Write a SIMPLE Monthly Summary (PT-BR). Markdown.
            
            Structure:
            1. **Resumo**: Total spent and comparison with last month.
            2. **Maiores Gastos**: List top 3 expenses.
            3. **Categorias**: Top spending category.
            
            Keep it short and direct. No advanced forecasting or personality.
            """
        
        
        response = model.generate_content(prompt)
        return response.text

    except Exception as e:
        print(f"❌ Error generating monthly report: {e}")
        return "Não foi possível gerar o relatório de IA no momento."

def generate_budget_plan(user_id: str) -> str:
    """
    Gera um plano de orçamento detalhado (Tabela) baseado na média de 3 meses.
    """
    if not GENAI_API_KEY:
            return "IA Indisponível."
            
    try:
        # 1. Coleta dados dos últimos 3 meses (90 dias)
        end_date = datetime.now()
        start_date = end_date - timedelta(days=90)
        
        txs = transaction_service.list_transactions(user_id, start_date=start_date, end_date=end_date)
        
        # Agrega por categoria
        cat_totals = {}
        for t in txs:
            if t.type == 'expense':
                c_name = t.category.name if t.category else "Outros"
                cat_totals[c_name] = cat_totals.get(c_name, 0) + abs(t.amount)
        
        # Calcula Média Mensal (Total / 3)
        cat_avg = {k: v / 3 for k, v in cat_totals.items()}
        
        # 2. Prompt
        context = f"Monthly Averages (Last 3 Months): {json.dumps(dict(sorted(cat_avg.items(), key=lambda x: x[1], reverse=True)), ensure_ascii=False)}"
        
        model = genai.GenerativeModel(AI_MODEL_NAME)
        prompt = f"""
        Data:
        {context}
        
        Role: Financial Planner.
        Task: Create a BUDGET PLAN to save 20% total.
        
        Output:
        1. Introduction: "Baseado nos seus últimos 3 meses..."
        2. Markdown Table: | Categoria | Média Atual | Meta Sugerida | Corte |
            - Suggest realistic cuts (more on leisure, less on essentials).
        3. Summary: "Se seguir isso, você economiza R$ X/mês."
        
        Language: PT-BR.
        """
        
        response = model.generate_content(prompt)
        return response.text
        
    except Exception as e:
        print(f"❌ Budget Plan Error: {e}")
        return "Erro ao gerar plano de orçamento."

def analyze_cost_of_living(user_id: str, data: dict, tier: str = 'free') -> str:
    """
    Analisa os dados de custo de vida e gera insights (Premium).
    """
    if tier != 'premium':
        return "A análise de IA do Custo de Vida é exclusiva para usuários Premium."
        
    if not GENAI_API_KEY:
        return "IA Indisponível no momento."

    try:
        # data contém: { range, realized, committed, variable_avg, total_estimated_monthly }
        
        realized_total = data.get('realized', {}).get('average_total', 0)
        committed_total = data.get('committed', {}).get('total', 0)
        total_est = data.get('total_estimated_monthly', 0)
        
        cats = data.get('realized', {}).get('by_category', {})
        top_cats = dict(sorted(cats.items(), key=lambda x: x[1], reverse=True)[:5])
        
        context = f"""
        User Financial Data (Monthly Average):
        - Total Estimated Cost: R${total_est:.2f}
        - Fixed/Committed Cost: R${committed_total:.2f} ({(committed_total/total_est)*100 if total_est else 0:.1f}%)
        - Variable Cost: R${realized_total:.2f} ({(realized_total/total_est)*100 if total_est else 0:.1f}%)
        - Top Variable Categories: {json.dumps(top_cats, ensure_ascii=False)}
        """
        
        model = genai.GenerativeModel(AI_MODEL_NAME)
        prompt = f"""
        Data:
        {context}
        
        Role: Efficient Financial Strategist.
        Task: Analyze the Cost of Living structure.
        
        Output (PT-BR, Markdown):
        1. **Diagnóstico**: Is the fixed cost too high? (>50% is risky). Is the variable cost out of control?
        2. **Alerta**: Point out the biggest offender in variable costs.
        3. **Sugestão Prática**: One concrete step to lower the Cost of Living based on this data.
        
        Keep it concise (max 300 words). Use bullet points.
        """
        
        response = model.generate_content(prompt)
        return response.text

    except Exception as e:
        print(f"❌ Cost of Living Analysis Error: {e}")
        return "Não foi possível gerar a análise. Tente novamente mais tarde."
