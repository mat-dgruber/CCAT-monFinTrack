# app/services/document_analysis.py
import json
import os
from typing import Any, Dict

from app.core.logger import get_logger
from app.services.ai_service import _call_with_retry
from app.services.user_preference import get_preferences
from google import genai

logger = get_logger(__name__)

# Reuse environment variables
GENAI_API_KEY = os.getenv("GOOGLE_API_KEY")
AI_MODEL_NAME = os.getenv("GOOGLE_AI_MODEL", "gemini-2.5-flash-lite")

client = None
if GENAI_API_KEY:
    client = genai.Client(api_key=GENAI_API_KEY)


class DocumentAnalysisService:
    @staticmethod
    def analyze_debt_document(
        user_id: str, file_bytes: bytes, mime_type: str
    ) -> Dict[str, Any]:
        """
        Analyzes a debt contract/statement (PDF or Image) and extracts structured data.
        Restricted to PREMIUM users (checked by caller or here).
        """
        # (Optional) Double check tier here if not done in API
        pref = get_preferences(user_id)
        if pref.subscription_tier != "premium":
            # Return error that frontend can parse
            return {"error": "Recurso disponível apenas para usuários Premium."}

        if not client:
            return {"error": "Serviço de IA indisponível no momento."}

        try:
            prompt = """
            Você é um Analista de Contratos Bancários Sênior.
            Primeiro, identifique o tipo de documento:
            - Financiamento Imobiliário → debt_type: "real_estate_financing"
            - Financiamento de Veículo → debt_type: "vehicle_financing"
            - Cartão de Crédito → debt_type: "credit_card_rotating"
            - Empréstimo Pessoal → debt_type: "personal_loan"
            - Consignado → debt_type: "consigned_credit"
            - Cheque Especial → debt_type: "overdraft"

            Extraia os dados no seguinte formato JSON:
            {
                "name": "Nome do Banco/Credor",
                "debt_type": "...",
                "status": "on_time",
                "total_amount": 0.00,
                "original_amount": 0.00,
                "interest_rate": 0.00,
                "interest_period": "monthly",
                "cet": 0.00,
                "minimum_payment": 0.00,
                "due_day": 0,
                "vehicle_brand": "...",
                "vehicle_model": "...",
                "vehicle_year": 0,
                "vehicle_plate": "...",
                "vehicle_renavam": "...",
                "amortization_system": "price" ou "sac",
                "indexer": "tr", "ipca", "poupanca" ou "none",
                "insurance_value": 0.00,
                "administration_fee": 0.00,
                "property_value": 0.00,
                "total_installments": 0,
                "installments_paid": 0,
                "is_under_construction": true ou false,
                "construction_end_date": "YYYY-MM-DD",
                "subsidy_amount": 0.00,
                "subsidy_expiration_date": "YYYY-MM-DD",
                "report": "MANDATORY: Detailed analysis explaining interest, amortization options, and management tips."
            }

            ### REGRAS:
            - Se não encontrar um campo, use null.
            - Retorne APENAS o JSON.
            """

            # Create content part
            from google.genai import types

            document_part = types.Part.from_bytes(data=file_bytes, mime_type=mime_type)

            # Centralized call with retry (importing the function here if needed or moving it to a core utility)
            # For now, let's use a local implementation of retry to avoid circular imports if shared

            config = types.GenerateContentConfig(
                response_mime_type="application/json",
                candidate_count=1,
                max_output_tokens=2048,
                temperature=0.2,  # Lower temperature for extraction
            )

            response = _call_with_retry(
                AI_MODEL_NAME, [prompt, document_part], config=config
            )
            if not response:
                return {"error": "Sem resposta da IA."}

            text = response.text.strip()
            return json.loads(text)

        except Exception as e:
            logger.error("Error analyzing document: %s", e, exc_info=True)
            return {"error": f"Falha ao analisar documento: {str(e)}"}
