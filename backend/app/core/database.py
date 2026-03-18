import json
import logging
import os
from unittest.mock import MagicMock

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import credentials, firestore

logger = logging.getLogger("monfintrack.database")

# Carrega as variáveis do arquivo .env
load_dotenv()


def get_db():
    # If we are testing, return a mock unless we really want real DB
    is_testing = "PYTEST_CURRENT_TEST" in os.environ or os.getenv("TESTING") == "True"

    if is_testing:
        # Check if already initialized to return real one if someone initialized it manually
        if firebase_admin._apps:
            return firestore.client()
        return MagicMock()

    if not firebase_admin._apps:
        # Tenta ler arquivo local (Dev)
        cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

        # Tenta ler JSON direto da variável (Prod/Render)
        json_creds = os.getenv("FIREBASE_CREDENTIALS_JSON")

        try:
            if cred_path and os.path.exists(cred_path):
                logger.info("Usando credenciais do arquivo: %s", cred_path)
                cred = credentials.Certificate(cred_path)
            elif json_creds:
                logger.info("Usando credenciais da variável FIREBASE_CREDENTIALS_JSON")
                cred_dict = json.loads(json_creds)
                cred = credentials.Certificate(cred_dict)
            else:
                logger.info("Tentando Application Default Credentials (ADC)...")
                cred = credentials.ApplicationDefault()

            firebase_admin.initialize_app(
                cred,
                {
                    "storageBucket": os.getenv(
                        "STORAGE_BUCKET", "ccat-monfintrack.firebasestorage.app"
                    )
                },
            )
            logger.info("✅ Conexão com Firebase inicializada com sucesso!")
        except Exception as e:
            logger.error("❌ ERRO CRÍTICO: Não foi possível inicializar o Firebase: %s", e, exc_info=True)
            # Em produção, queremos saber exatamente o que falhou
            if not is_testing:
                # Mantemos o erro para ser capturado no get_db
                pass

    try:
        if not firebase_admin._apps:
             raise Exception("Firebase Admin SDK não foi inicializado (sem apps).")
        return firestore.client()
    except Exception as e:
        if not is_testing:
            logger.error("❌ Erro ao obter cliente do Firestore: %s", e, exc_info=True)
        return MagicMock() if is_testing else None
