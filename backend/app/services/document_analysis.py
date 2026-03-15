#app/services/document_analysis.py
import json
import os
from typing import Any, Dict, Optional

from google import genai
from app.core.logger import get_logger
from app.services.user_preference import get_preferences

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

            Depois extraia os campos relevantes conforme o tipo identificado:

            ### PARTE 1: EXTRAÇÃO TÉCNICA (JSON)
            Extraia os dados no seguinte formato JSON estrito:
            {
                "name": "Nome do Banco/Credor",
                "debt_type": "...",
                "status": "on_time",
                "total_amount": 0.00 (Saldo Devedor Atual),
                "original_amount": 0.00 (Valor total financiado),
                "interest_rate": 0.00 (Taxa de juros mensal %),
                "interest_period": "monthly",
                "cet": 0.00 (Custo Efetivo Total ANUAL %),
                "minimum_payment": 0.00 (Valor do encargo mensal),
                "due_day": 0,
                
                // Campos Veículo (se aplicável)
                "vehicle_brand": "...",
                "vehicle_model": "...",
                "vehicle_year": 0,
                "vehicle_plate": "...",
                "vehicle_renavam": "...",
                
                // Campos Imóvel (se aplicável)
                "amortization_system": "price" ou "sac",
                "indexer": "tr", "ipca", "poupanca" ou "none",
                "insurance_value": 0.00,
                "administration_fee": 0.00,
                "property_value": 0.00,
                
                // Campos comuns a financiamentos
                "total_installments": 0,
                "installments_paid": 0,
                
                // Outros campos Imóvel
                "is_under_construction": true ou false,
                "construction_end_date": "YYYY-MM-DD",
                "subsidy_amount": 0.00,
                "subsidy_expiration_date": "YYYY-MM-DD"
            }

            ### PARTE 2: RELATÓRIO EDUCATIVO (MARKDOWN)
            Gere um relatório detalhado na chave "report" do JSON explicando:
            1. Como funcionam as taxas e o indexador especificamente para este contrato.
            2. De onde vem o juro mensal (base de cálculo).
            3. Como funcionam as amortizações extras: Redução de Prazo vs Prestação. Qual a melhor e por que.
            4. Dicas de gestão específicas para o tipo de dívida detectado.

            ### REGRAS CRÍTICAS:
            - Se não encontrar um campo, use null.
            - Retorne APENAS o JSON, sem textos explicativos fora do bloco.
            """

            # Create content part
            from google.genai import types
            document_part = types.Part.from_bytes(data=file_bytes, mime_type=mime_type)

            response = client.models.generate_content(
                model=AI_MODEL_NAME,
                contents=[prompt, document_part]
            )
            text = response.text.strip()

            # Clean Markdown
            if text.startswith("```"):
                text = (text.split("```")[1]).strip()
                if text.startswith("json"):
                    text = text[4:].strip()

            return json.loads(text)

        except Exception as e:
            logger.error("Error analyzing document: %s", e)
            return {"error": f"Falha ao analisar documento: {str(e)}"}
