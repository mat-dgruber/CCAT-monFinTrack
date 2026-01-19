import google.generativeai as genai
import os
import json
from typing import Dict, Any, Optional
from app.services.user_preference import get_preferences

# Reuse environment variables
GENAI_API_KEY = os.getenv("GOOGLE_API_KEY")
AI_MODEL_NAME = os.getenv("GOOGLE_AI_MODEL", "gemini-2.0-flash-lite")

if GENAI_API_KEY:
    genai.configure(api_key=GENAI_API_KEY)

class DocumentAnalysisService:
    @staticmethod
    def analyze_debt_document(user_id: str, file_bytes: bytes, mime_type: str) -> Dict[str, Any]:
        """
        Analyzes a debt contract/statement (PDF or Image) and extracts structured data.
        Restricted to PREMIUM users (checked by caller or here).
        """
        # (Optional) Double check tier here if not done in API
        pref = get_preferences(user_id)
        if pref.subscription_tier != 'premium':
             # Return error that frontend can parse
             return {"error": "Recurso disponível apenas para usuários Premium."}

        if not GENAI_API_KEY:
             return {"error": "Serviço de IA indisponível no momento."}

        try:
            model = genai.GenerativeModel(AI_MODEL_NAME)
            
            prompt = """
            Role: Expert Financial Document Analyzer.
            Task: Extract structured debt information from this document (Loan Contract, Credit Card Statement, etc.).
            Language: PT-BR.
            
            Target Fields (JSON):
            {
                "name": "Creditor Name / Bank",
                "total_amount": 0.00 (Outstanding Balance / Saldo Devedor),
                "original_amount": 0.00 (Contract Value / Valor Original),
                "interest_rate": 0.00 (Monthly Rate % / Taxa Mensal),
                "interest_period": "monthly" (or "yearly"),
                "cet": 0.00 (Custo Efetivo Total % a.m.),
                "installments_total": 0 (Total number of installments),
                "installments_paid": 0 (Number of paid installments),
                "due_day": 0 (Day of month),
                "debt_type": "type_enum" (Allowed: credit_card_rotating, credit_card_installment, personal_loan, vehicle_financing, real_estate_financing, overdraft, consigned_credit, other)
            }
            
            Rules:
            - If a value is not found, use null or 0.
            - Ensure 'interest_rate' is the MONTHLY rate. If yearly is found, convert or note it.
            - Look for "Taxa de Juros", "CET", "Saldo Devedor".
            - 'debt_type' MUST be one of the allowed values above.
            - Return PURE JSON.
            """
            
            # Create content part
            document_part = {
                "mime_type": mime_type,
                "data": file_bytes
            }
            
            response = model.generate_content([prompt, document_part])
            text = response.text.strip()
            
            # Clean Markdown
            if text.startswith("```"):
                text = (text.split("```")[1]).strip()
                if text.startswith("json"):
                    text = text[4:].strip()
            
            return json.loads(text)
            
        except Exception as e:
            print(f"❌ Error analyzing document: {e}")
            return {"error": f"Falha ao analisar documento: {str(e)}"}
