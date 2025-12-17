import google.generativeai as genai
import os
import hashlib
from app.core.database import get_db
from typing import List, Optional
from app.schemas.category import Category
from app.services import category as category_service
from app.services import account as account_service
from app.services import transaction as transaction_service
from datetime import datetime
import json

# Configura a API Key (carregada do .env pelo app)
GENAI_API_KEY = os.getenv("GOOGLE_API_KEY")

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
        
        # 2. Monta o Prompt
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        prompt = f"""
        Data:TOON(C[name,id])
        {cat_toon}
        Tx:"{description}"
        Return Category ID or "null".
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

def chat_finance(message: str, user_id: str, persona: str = 'friendly') -> str:
    """
    Chatbot financeiro que usa dados do usuário para responder perguntas.
    Persona: 'friendly' (padrão) ou 'roast' (sarcástico/engraçado).
    """
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
            
        tx_toon = "T[date,title,cat,amt]\n" + "\n".join(tx_info)
        
        # 2. Montar System Prompt
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        # Highly condensed context
        system_context = f"""
        Ctx:
        Bal:R${total_balance:.0f}
        Accs:{accounts_str}
        LastTx:
        {tx_toon}
        
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
            Task:Answer Q based on data. Be concise. PT-BR.
            If goal mentioned: Analyze/Suggest savings.
            """
        
        # 3. Call AI
        response = model.generate_content(final_prompt)
        return response.text

    except Exception as e:
        print(f"❌ Error calling Gemini AI Chat: {e}")
        return "Desculpe, erro ao processar. Tente novamente."

def parse_receipt(image_bytes: bytes, mime_type: str, user_id: str) -> Optional[dict]:
    """
    Analisa uma imagem de comprovante e extrai dados (Data, Valor, Título, Categoria).
    """
    if not GENAI_API_KEY:
        return None

    try:
        # 1. Contexto de Categorias (TOON)
        categories = category_service.list_categories(user_id)
        category_lines = [f"{c.name},{c.id}" for c in categories]
        cat_toon = "C[name,id]\n" + "\n".join(category_lines)

        # 2. Monta Prompt Multimodal
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        prompt = f"""
        Cats:
        {cat_toon}
        Task:Extract receipt data. Match Cat ID.
        JSON:{{title,amount,date(YYYY-MM-DD),category_id}}.
        Missing date=today. Ambiguous cat=null.
        """
        
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

    def generate_monthly_report(self, user_id: str, month: int, year: int) -> str:
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
            
            # 3. Formata Contexto para IA (TOON-ish)
            context = f"""
            Cur({month}/{year}):Tot:{total_current:.0f}
            Top3:{json.dumps(dict(sorted(cat_current.items(), key=lambda x: x[1], reverse=True)[:3]), ensure_ascii=False)}
            Prev({m_prev}/{y_prev}):Tot:{total_prev:.0f}
            Top3:{json.dumps(dict(sorted(cat_prev.items(), key=lambda x: x[1], reverse=True)[:3]), ensure_ascii=False)}
            """
            
            # 4. Prompt
            model = genai.GenerativeModel('gemini-1.5-flash')
            prompt = f"""
            Stats:
            {context}
            Task:PT-BR summary of spending changes. Up/Down? Main driver?
            Style:Short,insightful,fun. Use bold tags. Text body only.
            """
            
            response = model.generate_content(prompt)
            return response.text
            
        except Exception as e:
            print(f"❌ Error generating report: {e}")
            return "Erro ao gerar relatório. Tente novamente."
