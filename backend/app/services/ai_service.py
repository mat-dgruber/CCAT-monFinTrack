import hashlib
import json
import os
import random
import time
from datetime import datetime, timedelta
from typing import List, Optional

from app.core.database import get_db
from app.core.logger import get_logger
from app.services import account as account_service
from app.services import budget as budget_service
from app.services import category as category_service
from app.services import transaction as transaction_service
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

logger = get_logger(__name__)


# --- AI SCHEMAS (Saved Tokens vs Verbose Prompts) ---
class TransactionPayload(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    type: Optional[str] = None
    date: Optional[str] = None
    account_id: Optional[str] = None
    account: Optional[str] = None
    category_id: Optional[str] = None
    category: Optional[str] = None
    credit_card_id: Optional[str] = None
    credit_card: Optional[str] = None
    payment_method: Optional[str] = None


class ChatAction(BaseModel):
    type: str = Field(description="Action type: create_transaction, search, etc.")
    payload: TransactionPayload = Field(
        default_factory=TransactionPayload, description="Data for the action"
    )


class AIResponse(BaseModel):
    response: str = Field(description="Natural language response to the user")
    action: Optional[ChatAction] = Field(None, description="Optional structured action")


class ClassificationResponse(BaseModel):
    category_id: str = Field(description="The ID of the predicted category.")


# --- SYSTEM INSTRUCTIONS (Moved out of Prompt to save tokens) ---
SYSTEM_FINANCE_BASE = """Role: Financial Assistant. Task: Manage finances clearly and concisely. Language: PT-BR.
Rules:
1. Date/Time context: Use given now_str for relative 'yesterday', 'today'.
2. Transaction Extraction: Get short title and description.
3. ACCOUNT/PAYMENT:
   - Ask for Payment Method if missing.
   - Auto-select card if account has ONLY ONE.
   - ASK if ambiguous (multiple cards or no account).
4. If info missing, response must ask and action must be null."""

SYSTEM_FINANCE_ROAST = (
    SYSTEM_FINANCE_BASE
    + "\nExtra: Role is Sarcastic Roast. Be acidic and critique spending with humor."
)

SYSTEM_CLASSIFY = """You are an expert financial assistant. Your task is to classify a transaction description into one of the provided categories.
Output ONLY the category ID in JSON format. If no suitable category is found, output null.
Example: {"category_id": "12345"}"""

# Configura o Cliente (carregado do .env)
GENAI_API_KEY = os.getenv("GOOGLE_API_KEY")

client = None
if GENAI_API_KEY:
    client = genai.Client(api_key=GENAI_API_KEY)
else:
    logger.warning("GOOGLE_API_KEY not found. AI features will be disabled.")


def _call_with_retry(
    model_name, prompt_or_parts, retries=3, initial_delay=2, config=None
):
    """
    Helper function to call client.models.generate_content with exponential backoff for rate limits (429).
    """
    if not client:
        return None

    delay = initial_delay
    for attempt in range(retries):
        try:
            return client.models.generate_content(
                model=model_name, contents=prompt_or_parts, config=config
            )
        except Exception as e:
            error_str = str(e).lower()
            if (
                "429" in error_str
                or "quota" in error_str
                or "resourceexhausted" in error_str
                or "503" in error_str
                or "unavailable" in error_str
                or "500" in error_str
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
        return "gemini-2.5-flash-lite"
    elif tier == "pro":
        return "gemini-2.5-flash-lite"
    else:
        # Fallback ou Free (se chamado indevidamente)
        return "gemini-2.5-flash-lite"


def classify_transaction(
    description: str, user_id: str, tier: str = "pro"
) -> Optional[str]:
    """
    Usa IA para classificar transação.
    """
    if not client:
        return None

    try:
        # Hash inclui description, user_id E tier (privacidade e precisão)
        desc_clean = description.strip().lower()
        desc_hash = hashlib.md5(
            f"{user_id}:{desc_clean}".encode("utf-8"), usedforsecurity=False
        ).hexdigest()

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

        # 2. Few-Shot (Últimas 15 txs para economia de tokens)
        history = transaction_service.list_transactions(user_id, limit=15)
        examples = []
        for t in history:
            if t.category and t.title:
                clean_title = t.title.replace('"', "").strip()[:30]  # Limit length
                examples.append(f"{clean_title}->{t.category.id}")

        examples_block = "Hist:\n" + "\n".join(examples)

        # 3. Prompt Compacto
        model_name = get_model_for_tier(tier)

        prompt = f"{cat_context}\n{examples_block}\nClassify:'{description}'"

        # 4. Chama IA com JSON Nativo
        response = _call_with_retry(
            model_name=model_name,
            prompt_or_parts=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_CLASSIFY,
                response_mime_type="application/json",
                response_schema=ClassificationResponse,
                temperature=0.1,
            ),
        )

        if not response or not response.text:
            return None

        res_data = ClassificationResponse.model_validate_json(response.text)
        predicted_id = res_data.category_id

        if not predicted_id or predicted_id.lower() == "null":
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
    message: str,
    user_id: str,
    tier: str = "pro",
    persona: str = "friendly",
    history: Optional[List[dict]] = None,
) -> str:
    """
    Chatbot financeiro.
    """
    if tier == "free":
        return "Upgrade to Pro to chat with AI!"

    if not client:
        return "AI offline."

    try:
        # A. Contas (Minificado)
        accounts = account_service.list_accounts(user_id)
        acc_details = []
        for a in accounts:
            cards = (
                f"|C:{','.join([c.name[:10] for c in a.credit_cards])}"
                if a.credit_cards
                else ""
            )
            acc_details.append(f"{a.name[:15]}:R${int(a.balance)}{cards}")
        acc_str = " ; ".join(acc_details)

        # B. Transações (Compacto)
        transactions = transaction_service.list_transactions(user_id, limit=15)
        tx_list = [
            f"{t.date.strftime('%d/%m')} {t.title[:15]}:R${float(t.amount):.0f}"
            for t in transactions
        ]
        tx_str = "\n".join(tx_list)
        # C. Totais Mês Atual
        now = datetime.now()
        start_month = datetime(now.year, now.month, 1)
        try:
            txs_month = transaction_service.list_transactions(
                user_id, start_date=start_month, limit=100
            )
        except Exception as e:
            logger.error("Error listing month transactions: %s", e)
            txs_month = []

        cat_totals = {}
        total_spent = 0
        for t in txs_month:
            if t.type == "expense":
                c = t.category.name if t.category else "Outros"
                v = abs(float(t.amount))
                cat_totals[c] = cat_totals.get(c, 0) + v

        top_cats = dict(
            sorted(cat_totals.items(), key=lambda x: x[1], reverse=True)[:5]
        )
        total_spent = sum(cat_totals.values())

        # D. Histórico e Relógio
        now_str = now.strftime("%Y-%m-%d %H:%M:%S (%A)")
        contents = []
        if history:
            # Pegar últimas 6 mensagens do histórico e formatar para o SDK
            for h in history[-6:]:
                role = "user" if h["role"] == "user" else "model"
                contents.append(
                    types.Content(
                        role=role, parts=[types.Part.from_text(text=h["content"])]
                    )
                )

        # 2. IA Configs
        model_name = get_model_for_tier(tier)
        sys_instr = SYSTEM_FINANCE_ROAST if persona == "roast" else SYSTEM_FINANCE_BASE

        # 3. Prompt Compacto
        user_prompt = f"Now:{now_str} | Bal:{acc_str} | Month:R${total_spent:.0f} | Top:{json.dumps(top_cats)}\nTXs:\n{tx_str if tx_str else 'None'}\n\nUser Question: {message}"
        contents.append(
            types.Content(role="user", parts=[types.Part.from_text(text=user_prompt)])
        )

        # 4. Chama a IA com Schema JSON Nativo
        response = client.models.generate_content(
            model=model_name,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=sys_instr,
                response_mime_type="application/json",
                response_schema=AIResponse,
                temperature=0.8 if persona == "roast" else 0.4,
            ),
        )

        if not response or not response.text:
            return "AI offline ou sem resposta."

        # Parse via Pydantic (garante validação total)
        ai_data = AIResponse.model_validate_json(response.text)

        final_message = ai_data.response
        action_data = None
        if ai_data.action:
            # Converte para o formato interno que o app espera (Payload legacy)
            action_data = {
                "type": ai_data.action.type,
                "data": ai_data.action.payload.model_dump(),
            }

        # 1.b Pre-fetch Categories for resolution se houver ação
        categories = []
        if action_data:
            try:
                categories = category_service.list_all_categories_flat(user_id)
            except Exception as e:
                logger.error("Error listing categories for chat: %s", e)
                categories = []

        # 4. Action JSON Handling
        def process_json_action(action_data):
            try:
                if action_data.get("type") == "create_transaction":
                    from app.schemas.transaction import TransactionCreate

                    t_data = action_data["data"]

                    # Resolve Account
                    acc_id = t_data.get("account_id")
                    target_account = None
                    if not acc_id:
                        acc_name = t_data.get("account")
                        if acc_name and accounts:
                            # Try match name
                            for a in accounts:
                                if a.name.lower() == acc_name.lower():
                                    acc_id = a.id
                                    target_account = a
                                    break

                        # Fallback to first account ONLY if there's only one account total
                        if not acc_id and len(accounts) == 1:
                            acc_id = accounts[0].id
                            target_account = accounts[0]
                    else:
                        # Find object for acc_id
                        for a in accounts:
                            if a.id == acc_id:
                                target_account = a
                                break

                    if not acc_id:
                        return " (Não consegui encontrar uma conta para salvar a transação)"

                    # Resolve Credit Card
                    cc_id = t_data.get("credit_card_id")
                    cc_name_display = ""

                    if not cc_id and target_account:
                        cc_name_input = t_data.get("credit_card")
                        if cc_name_input and target_account.credit_cards:
                            for c in target_account.credit_cards:
                                if c.name.lower() == cc_name_input.lower():
                                    cc_id = c.id
                                    cc_name_display = c.name
                                    break

                        # Auto-select if only one card in the account
                        if (
                            not cc_id
                            and target_account.credit_cards
                            and len(target_account.credit_cards) == 1
                        ):
                            cc_id = target_account.credit_cards[0].id
                            cc_name_display = target_account.credit_cards[0].name

                    # Resolve Category
                    cat_id = t_data.get("category_id")
                    if not cat_id:
                        cat_name = t_data.get("category")
                        if cat_name and categories:
                            for c in categories:
                                if c.name.lower() == cat_name.lower():
                                    cat_id = c.id
                                    break

                        # Se não encontrar, tenta criar ou usa default?
                        # Aqui vamos apenas usar o fallback se existir
                        if not cat_id and categories:
                            cat_id = categories[0].id

                    if not cat_id:
                        return " (Não consegui encontrar uma categoria adequada)"

                    # Fix: Handle description vs title mismatch
                    title_val = (
                        t_data.get("title")
                        or t_data.get("description")
                        or "Transação IA"
                    )
                    if len(title_val) < 3:
                        title_val = f"{title_val} IA"

                    description_val = t_data.get("description")

                    # Fix: Handle amount parsing with possible comma
                    amount_str = str(t_data["amount"]).replace(",", ".")
                    amount_val = abs(float(amount_str))

                    # Resolve Date
                    tx_date = datetime.now()
                    date_str = t_data.get("date")
                    if date_str:
                        try:
                            # Aceita YYYY-MM-DD
                            parsed_date = datetime.strptime(date_str, "%Y-%m-%d")
                            # Manter a hora atual para não ficar tudo meia-noite
                            now_time = datetime.now()
                            tx_date = parsed_date.replace(
                                hour=now_time.hour,
                                minute=now_time.minute,
                                second=now_time.second,
                            )
                        except ValueError:
                            logger.warning(
                                "AI provided invalid date format: %s", date_str
                            )

                    # Resolve Payment Method
                    payment_method_val = t_data.get("payment_method", "debit_card")
                    if cc_id and not t_data.get("payment_method"):
                        payment_method_val = "credit_card"

                    new_tx = TransactionCreate(
                        title=title_val,
                        description=description_val,
                        amount=amount_val,
                        type=t_data.get("type", "expense"),
                        category_id=cat_id,
                        account_id=acc_id,
                        credit_card_id=cc_id,
                        payment_method=payment_method_val,
                        date=tx_date,
                        status="paid",
                    )
                    created = transaction_service.create_transaction(new_tx, user_id)
                    date_display = created.date.strftime("%d/%m")
                    cc_info = f" no cartão {cc_name_display}" if cc_id else ""
                    return f"\n\n✅ Transação anotada ({date_display}): {created.title} (R$ {created.amount:.2f}){cc_info}."
            except Exception as e:
                logger.error("Error creating AI transaction: %s", e, exc_info=True)
                return f"\n\n❌ Erro ao salvar transação: {str(e)}"
            return ""

        if action_data:
            result_msg = process_json_action(action_data)
            final_message += result_msg

        return final_message

    except Exception as e:
        logger.error("Chat Error: %s", e, exc_info=True)
        print(f"[DEBUG] {type(e).__name__}: {e}")
        return "Tive um problema técnico ao processar sua mensagem. Pode repetir?"


def parse_receipt(
    image_bytes: bytes, mime_type: str, user_id: str, tier: str = "pro"
) -> Optional[dict]:
    """
    Extrai dados de comprovante com foco em descrição detalhada (Itens + Localização).
    """
    if not client:
        return None

    try:
        categories = category_service.list_categories(user_id)
        cat_str = ";".join([f"{c.id}:{c.name}" for c in categories])

        model_name = get_model_for_tier(tier)

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

        # For vision, the new SDK uses a different parts structure
        from google.genai import types

        img_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            candidate_count=1,
            max_output_tokens=1000,
        )

        response = _call_with_retry(model_name, [prompt, img_part], config=config)
        if not response:
            return {"error": "Sem resposta da AI após o upload."}

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

    except Exception as e:
        logger.error("Receipt Error: %s", e)
        return None


def generate_monthly_report(
    user_id: str, month: int, year: int, tier: str = "pro"
) -> str:
    """
    Relatório mensal com Cache e Modelo Dinâmico.
    """
    if not client:
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
            f"{user_id}:{month}:{year}:{len(txs)}:{total_amount:.2f}:{tier}".encode(),
            usedforsecurity=False,
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
                logger.info("[REPORTE] Cache hit.")
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
        logger.info("[REPORTE] Tópicos calculados: %s", top3)

        # --- BUDGETS ---
        budgets = budget_service.list_budgets_with_progress(user_id, month, year)
        over_budget = []
        for b in budgets:
            if b["spent"] > b["amount"]:
                c_name = b["category"].name if b["category"] else "Other"
                over_budget.append(f"{c_name}:+R${(b['spent'] - b['amount']):.0f}")

        budget_ctx = "Over:" + ",".join(over_budget) if over_budget else "Budgets OK"
        logger.info("[REPORTE] Budget Context: %s", budget_ctx)
        # ---------------

        # 4. Prompt
        ctx = f"M:{month}/{year}. Tot:R${total:.0f}. Top3:{json.dumps(top3, ensure_ascii=False)}. {budget_ctx}"

        model_name = get_model_for_tier(tier)

        if tier == "premium":
            prompt = f"""
            Data:{ctx}
            Role:Financial Expert.
            Task:Comprehensive Report (PT-BR).
            1.Health Score(0-10).
            2.Expense Trends vs Top Categories.
            3.Budget Compliance (highlight over-budget areas).
            4.Forecast & Saving Advice.
            """
        else:
            prompt = f"""
            Data:{ctx}
            Role:Assistant.
            Task:Monthly Summary (PT-BR).
            1.Total Expenses.
            2.Top Categories.
            3.Budget Status (if any category exceeded).
            Keep it actionable.
            """

        response = _call_with_retry(model_name, prompt)
        if not response:
            return "Não foi possível conectar ao consultor financeiro agora. Tente novamente em instantes."

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
        logger.error(
            "Report Error for user %s (%d/%d): %s",
            user_id,
            month,
            year,
            e,
            exc_info=True,
        )
        return "Erro ao gerar."


def generate_budget_plan(user_id: str, tier: str = "pro") -> str:
    """
    Gera um plano orçamentário (50/30/20 ou Base Zero) com base nos gastos recentes.
    """
    if not client:
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

        response = _call_with_retry(model_name, prompt)
        if not response:
            return "Erro ao contatar a IA para o plano."

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
    if not client:
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

        response = _call_with_retry(model_name, prompt)
        if not response:
            return "O consultor de dívidas está ocupado. Tente logo mais."

        return response.text

    except Exception as e:
        logger.error("Debt Advice Error: %s", e)
        return "Erro ao analisar dívidas."


def analyze_cost_of_living(user_id: str, data: dict, tier: str = "premium") -> str:
    """
    Analisa os dados de custo de vida e fornece insights sobre anomalias e projeções.
    """
    if not client:
        return "IA indisponível."

    try:
        # 1. Preparar Contexto
        # Extrair dados básicos para o prompt
        range_info = data.get("range", {})
        realized = data.get("realized", {})
        committed = data.get("committed", {})
        categories = data.get("categories", [])

        cat_str = "|".join([f"{c['name']}: {c['value']}" for c in categories[:10]])

        ctx = (
            f"Range: {range_info.get('months_count')} months. "
            f"Avg Realized: R${realized.get('average_total', 0):.0f}. "
            f"Committed: R${committed.get('total', 0):.0f}. "
            f"Top Cats: [{cat_str}]"
        )

        # 2. Prompt
        model_name = get_model_for_tier(tier)

        prompt = f"""
        Data: {ctx}
        Role: Amigo e Mentor Financeiro (Papo reto, simples e popular).
        Task: Analisar o Custo de Vida (PT-BR).
        Passos:
        1. Avalie se a média de gastos está saudável ou se o bicho vai pegar.
        2. Aponte onde o dinheiro está fugindo (gastos desnecessários).
        3. Dê uma dica prática e "pé no chão" para baixar o custo mensal.
        4. Fale de forma simples sobre o futuro e o que está fora do comum.
        Estilo: Markdown. Linguagem super acessível, direta, como se estivesse explicando para um amigo no café. Evite termos técnicos complicados. Máximo 3 parágrafos curtos.
        """

        response = _call_with_retry(model_name, prompt)
        if not response:
            return "Não foi possível analisar o custo de vida agora."

        return response.text

    except Exception as e:
        logger.error("Cost of Living Analysis Error: %s", e)
        return "Erro ao analisar custo de vida."


def generate_weekly_insights(user_id: str, data: dict, tier: str = "pro") -> str:
    """
    Gera insights personalizados para o relatório semanal.
    data: {
        "income": float,
        "expense": float,
        "balance": float,
        "top_categories": [{"name": str, "amount": float}],
        "period": str (ex: "09 Mar - 16 Mar")
    }
    """
    if not client:
        return ""

    try:
        cat_str = "|".join(
            [f"{c['name']}:R${c['amount']:.0f}" for c in data.get("top_categories", [])]
        )
        ctx = (
            f"Period:{data.get('period')} | "
            f"In:R${data.get('income'):.0f} | "
            f"Out:R${data.get('expense'):.0f} | "
            f"Bal:R${data.get('balance'):.0f} | "
            f"Cats:[{cat_str}]"
        )

        model_name = get_model_for_tier(tier)

        prompt = f"""
        Data: {ctx}
        Role: CapyCro (Mascote e Mentor Financeiro). Amigável, motivador, mas direto.
        Task: Analisar a semana e dar um "Conselho da CapyCro" (PT-BR).

        Regras:
        1. Comece com um elogio ou observação sobre o padrão de gastos.
        2. Dê uma dica prática baseada na maior categoria de gasto.
        3. Termine com uma frase motivadora curta.
        4. Máximo 4 frases curtas. Sem termos técnicos.

        Estilo: Texto puro, sem markdown complexo.
        """

        response = _call_with_retry(model_name, prompt)
        if not response:
            return ""

        return response.text.strip()

    except Exception as e:
        logger.error("Weekly Insights Error: %s", e)
        return "Continue focado em seus objetivos financeiros! A consistência é o segredo do sucesso."


# --- Instância para Exportação (Retrocompatibilidade) ---
class AIService:
    def __init__(self):
        self.chat_finance = chat_finance
        self.classify_transaction = classify_transaction
        self.parse_receipt = parse_receipt
        self.generate_monthly_report = generate_monthly_report
        self.generate_budget_plan = generate_budget_plan
        self.generate_debt_advice = generate_debt_advice
        self.analyze_cost_of_living = analyze_cost_of_living
        self.generate_weekly_insights = generate_weekly_insights


ai_service = AIService()
