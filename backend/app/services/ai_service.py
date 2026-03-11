import hashlib
import json
import os
import random
import time
from datetime import datetime, timedelta
from typing import List, Optional

import google.generativeai as genai
from app.core.database import get_db
from app.core.logger import get_logger
from app.schemas.category import Category
from app.services import account as account_service
from app.services import category as category_service
from app.services import transaction as transaction_service

logger = get_logger(__name__)

# Configura a API Key (carregado do .env)
GENAI_API_KEY = os.getenv("GOOGLE_API_KEY")

if GENAI_API_KEY:
    genai.configure(api_key=GENAI_API_KEY)
else:
    logger.warning("GOOGLE_API_KEY not found. AI features will be disabled.")


def _call_with_retry(model, prompt_or_parts, retries=3, initial_delay=2):
    """
    Helper function to call model.generate_content with exponential backoff for rate limits (429).
    """
    delay = initial_delay
    for attempt in range(retries):
        try:
            return model.generate_content(prompt_or_parts)
        except Exception as e:
            error_str = str(e).lower()
            if (
                "429" in error_str
                or "quota" in error_str
                or "resourceexhausted" in error_str
            ):
                if attempt < retries - 1:
                    sleep_time = delay + random.uniform(0, 1)  # Add jitter
                    logger.info(
                        "Quota exceeded. Retrying in %.2fs... (Attempt %d/%d)",
                        sleep_time,
                        attempt + 1,
                        retries,
                    )
                    time.sleep(sleep_time)
                    delay *= 2  # Exponential backoff
                else:
                    logger.error("Max retries reached for AI call.")
                    raise e
            else:
                raise e


def get_model_for_tier(tier: str = "free") -> str:
    """
    Retorna o modelo adequado para o Tier do usuário.
    """
    if tier == "premium":
        return "gemini-3-flash-preview"
    elif tier == "pro":
        return "gemini-2.5-flash-lite"
    else:
        # Fallback ou Free (se chamado indevidamente)
        return "gemini-2.0-flash-lite"


def classify_transaction(
    description: str, user_id: str, tier: str = "pro"
) -> Optional[str]:
    """
    Usa IA para classificar transação.
    """
    if not GENAI_API_KEY:
        return None

    try:
        # 0. CACHE check (Smart Hashing)
        # Hash inclui description E tier (caso modelos diferentes dêem resultados diferentes)
        desc_clean = description.strip().lower()
        desc_hash = hashlib.md5(f"{desc_clean}".encode("utf-8")).hexdigest()

        db = get_db()
        cache_ref = db.collection("ai_predictions").document(desc_hash)
        cache_doc = cache_ref.get()

        if cache_doc.exists:
            data = cache_doc.to_dict()
            if data.get("category_id"):
                logger.debug(
                    "AI Cache Hit: '%s' -> %s", description, data.get("category_id")
                )
                return data.get("category_id")

        # 1. Contexto Minificado (Token Saving)
        categories = category_service.list_categories(user_id)
        # Ex: "Transporte,123\nAlimentação,456"
        cat_lines = [f"{c.name},{c.id}" for c in categories]
        cat_context = "C:\n" + "\n".join(cat_lines)

        # 2. Few-Shot (Últimas 30 txs)
        history = transaction_service.list_transactions(user_id, limit=30)
        examples = []
        for t in history:
            if t.category and t.title:
                clean_title = t.title.replace('"', "").strip()[:30]  # Limit length
                examples.append(f"{clean_title}->{t.category.id}")

        examples_block = "Hist:\n" + "\n".join(examples)

        # 3. Prompt Otimizado
        model_name = get_model_for_tier(tier)
        model = genai.GenerativeModel(model_name)

        prompt = f"""
        {cat_context}
        {examples_block}
        
        Task: Classify '{description}'. verify Hist for patterns.
        Ret: CategoryID OR 'null'.
        """

        # 3. Chama a IA
        response = _call_with_retry(model, prompt)
        predicted_id = response.text.strip()

        if predicted_id.lower() == "null":
            return None

        # Valida ID
        valid_ids = {c.id for c in categories}
        if predicted_id in valid_ids:
            # 4. SALVA NO CACHE
            cache_ref.set(
                {
                    "description": desc_clean,
                    "category_id": predicted_id,
                    "tier_used": tier,
                    "created_at": datetime.now(),
                }
            )
            return predicted_id

        return None

    except Exception as e:
        logger.error("Error calling AI (%s): %s", tier, e)
        return None


def chat_finance(
    message: str, user_id: str, tier: str = "pro", persona: str = "friendly"
) -> str:
    """
    Chatbot financeiro.
    """
    if tier == "free":
        return "Upgrade to Pro to chat with AI!"

    if not GENAI_API_KEY:
        return "AI offline."

    try:
        # 1. Contexto Otimizado

        # A. Contas (Simplificado)
        accounts = account_service.list_accounts(user_id)
        acc_str = ",".join([f"{a.name}:{int(a.balance)}" for a in accounts])

        # B. Transações (Últimas 15 para manter o contexto leve)
        transactions = transaction_service.list_transactions(user_id, limit=15)
        tx_list = []
        for t in transactions:
            d = t.date.strftime("%d")
            n = t.title[:15]
            v = int(t.amount)
            c = t.category.name if t.category else "?"
            tx_list.append(f"{d},{n},{v},{c}")
        tx_str = "\n".join(tx_list)

        # C. Totais Mês Atual (Limitado a 50 transações recentes para evitar congelamento do BD a cada mensagem)
        now = datetime.now()
        start_month = datetime(now.year, now.month, 1)
        txs_month = transaction_service.list_transactions(
            user_id, start_date=start_month, limit=50
        )

        cat_totals = {}
        total_spent = 0
        for t in txs_month:
            if t.type == "expense":
                c = t.category.name if t.category else "Other"
                v = abs(t.amount)
                cat_totals[c] = cat_totals.get(c, 0) + v
                total_spent += v

        top_cats = dict(
            sorted(cat_totals.items(), key=lambda x: x[1], reverse=True)[:5]
        )

        # 2. System Prompt
        model_name = get_model_for_tier(tier)
        model = genai.GenerativeModel(model_name)

        sys_ctx = f"""
        Ctx:
        Accs:{acc_str}
        Spent:{int(total_spent)} (Top 50 txs)
        Top:{json.dumps(top_cats, ensure_ascii=False)}
        LastTx:
        {tx_str}
        
        Q:{message}
        """

        if persona == "roast":
            final_prompt = f"""
            {sys_ctx}
            Role:Sarcastic.
            Task:Roast spending. PT-BR.
            Output as valid JSON: {{"response": "your message here", "action": null}}
            """
        else:
            final_prompt = f"""
            {sys_ctx}
            Role:FinAssistant.
            Rules:
            1. PT-BR. Concise.
            2. To add a transaction, populate "action" with action type 'create_transaction' and necessary data.
            3. Must output ONLY valid object JSON format.
            Example JSON:
            {{
              "response": "Adicionei sua pizza no crédito!",
              "action": {{
                "type": "create_transaction",
                "data": {{"amount": 50, "title": "Pizza", "category": "Alimentação", "account": "Nubank", "type": "expense"}}
              }}
            }}
            If no action is needed, send "action": null.
            """

        response = _call_with_retry(
            model,
            final_prompt,
        )
        text_response = response.text.strip()
        
        # Limpar markdown ```json se presente
        if "```json" in text_response:
            text_response = text_response.replace("```json", "").replace("```", "").strip()

        # Parse the JSON response
        try:
            ai_data = json.loads(text_response)
        except json.JSONDecodeError:
            return response.text # Fallback to raw text if model ignores instructions
        
        final_message = ai_data.get("response", "Não entendi.")
        action_data = ai_data.get("action")

        # 1.b Pre-fetch Categories for resolution se houver ação
        categories = category_service.list_categories(user_id) if action_data else []

        # 4. Action JSON Handling
        def process_json_action(action_data):
            try:
                if (
                    action_data.get("type") == "action"
                    and action_data.get("action") == "create_transaction"
                ):
                    from app.schemas.transaction import TransactionCreate

                    t_data = action_data["data"]

                    # Resolve Account
                    acc_id = t_data.get("account_id")
                    if not acc_id:
                        acc_name = t_data.get("account")
                        if acc_name and accounts:
                            # Try match name
                            for a in accounts:
                                if a.name.lower() == acc_name.lower():
                                    acc_id = a.id
                                    break

                        # Fallback to first account
                        if not acc_id and accounts:
                            acc_id = accounts[0].id

                    if not acc_id:
                        raise ValueError("No account found")

                    # Resolve Category
                    cat_id = t_data.get("category_id")
                    if not cat_id:
                        cat_name = t_data.get("category")
                        if cat_name and categories:
                            for c in categories:
                                if c.name.lower() == cat_name.lower():
                                    cat_id = c.id
                                    break
                        # Fallback if still no category?
                        # Try to find 'Outros' or first
                        if not cat_id and categories:
                            cat_id = categories[0].id

                    if not cat_id:
                        raise ValueError("No category found")

                    # Fix: Handle description vs title mismatch
                    title_val = (
                        t_data.get("title")
                        or t_data.get("description")
                        or "Transaction"
                    )

                    new_tx = TransactionCreate(
                        title=title_val,
                        amount=float(t_data["amount"]),
                        type=t_data.get("type", "expense"),
                        category_id=cat_id,
                        account_id=acc_id,
                        payment_method="credit_card",
                        date=datetime.now(),
                        status="paid",
                    )
                    created = transaction_service.create_transaction(new_tx, user_id)
                    return f"✅ Criado: {created.title} (R$ {created.amount})."
            except Exception as e:
                pass
            return None

        if action_data:
            result = process_json_action(action_data)
            if result:
                return f"{final_message}\n\n{result}"

        return final_message

    except Exception as e:
        logger.error("Chat Error: %s", e)
        return "Erro no chat."


def parse_receipt(
    image_bytes: bytes, mime_type: str, user_id: str, tier: str = "pro"
) -> Optional[dict]:
    """
    Extrai dados de comprovante com foco em descrição detalhada (Itens + Localização).
    """
    if not GENAI_API_KEY:
        return None

    try:
        categories = category_service.list_categories(user_id)
        cat_str = ";".join([f"{c.id}:{c.name}" for c in categories])

        model_name = get_model_for_tier(tier)
        model = genai.GenerativeModel(model_name)

        # Otimização do Prompt: Instruções detalhadas para o campo 'description'
        prompt = f"""
        Ctx:Cats:{cat_str}
        
        Task: Extract Receipt Data (PT-BR).
        
        Return ONLY a valid JSON object with EXACTLY these keys:
        - "date": YYYY-MM-DD (String)
        - "amount": Total Value (Float)
        - "title": Store Name (String)
        - "category_id": Best Match ID from Ctx (String or null)
        - "payment_method": credit_card, debit_card, pix, cash (String)
        - "description": MUST FOLLOW THIS STRUCTURE: 
          [Full Address]. Items: [(Qty)x Name (Price) - Discount]. 
          Example: "Rua ABC, 123, SP. Items: 1x Livro (R$10); 2x Caneta (R$5)." (String)

        Important: Do not use markdown backticks in the response. Return raw JSON.
        """

        response = _call_with_retry(
            model, [prompt, {"mime_type": mime_type, "data": image_bytes}]
        )
        text = response.text.strip()

        # Limpeza de markdown caso o modelo ignore a instrução
        if "```json" in text:
            text = text.replace("```json", "").replace("```", "").strip()

        try:
            data = json.loads(text)
            return {
                "date": data.get("date"),
                "amount": float(data.get("amount", 0)),
                "title": data.get("title", "Desconhecido"),
                "category_id": data.get("category_id"),
                "payment_method": data.get("payment_method", "credit_card"),
                "description": data.get("description", ""),
                "items": [],  # Backward compatibility
            }
        except json.JSONDecodeError:
            logger.warning("AI Parse Failed (Invalid JSON). Response: %s", text)
            return None

        logger.warning("AI Parse Failed. Response: %s", text)
        return None

    except Exception as e:
        logger.error("Receipt Error: %s", e)
        return None


def generate_monthly_report(
    user_id: str, month: int, year: int, tier: str = "pro"
) -> str:
    """
    Relatório mensal com Cache e Modelo Dinâmico.
    """
    if not GENAI_API_KEY:
        return "IA indisponível."

    try:
        # 1. Dados
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1) - timedelta(seconds=1)
        else:
            end_date = datetime(year, month + 1, 1) - timedelta(seconds=1)

        txs = transaction_service.list_transactions(
            user_id, start_date=start_date, end_date=end_date
        )

        # 2. Cache Key (Hash rápido: User+Date+Length+Sum+Tier)
        total_amount = sum(t.amount for t in txs)
        full_hash = hashlib.md5(
            f"{user_id}{month}{year}{len(txs)}{total_amount:.2f}{tier}".encode()
        ).hexdigest()

        db = get_db()
        report_ref = (
            db.collection("users")
            .document(user_id)
            .collection("reports")
            .document(f"{year}-{month}")
        )
        doc = report_ref.get()
        if doc.exists:
            d = doc.to_dict()
            if d.get("hash") == full_hash and d.get("content"):
                return d.get("content")

        # 3. Processamento
        total = 0
        cat_vals = {}
        for t in txs:
            if t.type == "expense":
                v = abs(t.amount)
                total += v
                c = t.category.name if t.category else "Oth"
                cat_vals[c] = cat_vals.get(c, 0) + v

        top3 = dict(sorted(cat_vals.items(), key=lambda x: x[1], reverse=True)[:3])

        # 4. Prompt
        ctx = f"M:{month}/{year}. Tot:R${total:.0f}. Top3:{json.dumps(top3, ensure_ascii=False)}"

        model_name = get_model_for_tier(tier)
        model = genai.GenerativeModel(model_name)

        if tier == "premium":
            prompt = f"""
            Data:{ctx}
            Role:Expert Advisor.
            Task:Premium Report (PT-BR).
            1.Health Score(0-10).
            2.Trends.
            3.Forecast.
            4.Actionable Tip.
            """
        else:
            prompt = f"""
            Data:{ctx}
            Role:Assistant.
            Task:Simple Summary (PT-BR).
            1.Total.
            2.Top Cats.
            Keep it short.
            """

        response = _call_with_retry(model, prompt)
        content = response.text

        # 5. Salvar Cache
        report_ref.set(
            {
                "created_at": datetime.now(),
                "hash": full_hash,
                "content": content,
                "month": month,
                "year": year,
                "tier": tier,
            }
        )

        return content

    except Exception as e:
        logger.error("Report Error: %s", e)
        return "Erro ao gerar."


def generate_budget_plan(user_id: str, tier: str = "pro") -> str:
    """
    Gera um plano orçamentário (50/30/20 ou Base Zero) com base nos gastos recentes.
    """
    if not GENAI_API_KEY:
        return "IA indisponível. Verifique a API Key."

    try:
        # 1. Analisar últimos 30 dias
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)
        txs = transaction_service.list_transactions(
            user_id, start_date=start_date, end_date=end_date
        )

        income = 0
        expenses = 0
        cat_map = {}

        for t in txs:
            val = float(t.amount)
            if t.type == "income":
                income += val
            elif t.type == "expense":
                expenses += abs(val)
                cat_name = t.category.name if t.category else "Outros"
                cat_map[cat_name] = cat_map.get(cat_name, 0) + abs(val)

        # Se não houver dados suficientes
        if income == 0 and expenses == 0:
            return (
                "Não há transações suficientes nos últimos 30 dias para gerar um plano."
            )

        # 2. Contexto Otimizado (TOON)
        # I:Income, E:Expense, C:[Cat:Val]
        top_cats = dict(sorted(cat_map.items(), key=lambda x: x[1], reverse=True)[:10])
        cat_str = "|".join([f"{k}:{v:.0f}" for k, v in top_cats.items()])

        ctx = f"I:{income:.0f}|E:{expenses:.0f}|C:[{cat_str}]"

        # 3. Prompt
        model_name = get_model_for_tier(tier)
        model = genai.GenerativeModel(model_name)

        prompt = f"""
        Data:{ctx}
        Role:Financial Planner.
        Task:Create a monthly budget plan (PT-BR).
        
        Steps:
        1. Analyze I vs E (Savings rate?).
        2. Suggest 50/30/20 split based on I.
        3. Recommend specific limits for top C to fit the plan.
        4. Actionable advice to reduce E if E > I.
        
        Format: Markdown. Concise. Use bullets.
        """

        response = _call_with_retry(model, prompt)
        return response.text

    except Exception as e:
        logger.error("Budget Plan Error: %s", e)
        return "Erro ao gerar plano orçamentário."


def generate_debt_advice(
    user_id: str, debts_data: list, current_surplus: float, tier: str = "pro"
) -> str:
    """
    Gera conselhos sobre dívidas (Avalanche vs Bola de Neve).
    debts_data: Lista de dicts ou objetos com {name, total_amount, interest_rate, minimum_payment}
    """
    if not GENAI_API_KEY:
        return "IA indisponível."

    try:
        # 1. Formatar dados das dívidas
        # D:[Name:Val@Rate%(Min)]
        debt_list = []
        total_debt = 0
        for d in debts_data:
            # Handle object or dict safely
            if isinstance(d, dict):
                name = d.get("name", "Debt")
                amt = float(d.get("total_amount", 0))
                rate = float(d.get("interest_rate", 0))
                min_pay = float(d.get("minimum_payment", 0))
            else:
                name = getattr(d, "name", "Debt")
                amt = float(getattr(d, "total_amount", 0))
                rate = float(getattr(d, "interest_rate", 0))
                min_pay = float(getattr(d, "minimum_payment", 0))

            total_debt += amt
            debt_list.append(f"{name}:{amt:.0f}@{rate}%(Min:{min_pay:.0f})")

        debts_str = "|".join(debt_list)

        # 2. Prompt
        ctx = (
            f"Debts:[{debts_str}]|Surplus:{current_surplus:.0f}|Total:{total_debt:.0f}"
        )

        model_name = get_model_for_tier(tier)
        model = genai.GenerativeModel(model_name)

        prompt = f"""
        Data:{ctx}
        Role:Debt Specialist.
        Task:Debt Payoff Strategy (PT-BR).
        
        Steps:
        1. Compare 'Snowball' (Smallest first) vs 'Avalanche' (Highest Interest first) for this specific scenario.
        2. Recommend the best one mathematically vs psychologically.
        3. Estimate payoff time with Surplus.
        
        Format: Markdown. Short and encouraging.
        """

        response = _call_with_retry(model, prompt)
        return response.text

    except Exception as e:
        logger.error("Debt Advice Error: %s", e)
        return "Erro ao analisar dívidas."
