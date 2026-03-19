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


_db_cache = None


def get_db():
    global _db_cache

    # If we are testing, return a mock unless we really want real DB
    is_testing = "PYTEST_CURRENT_TEST" in os.environ or os.getenv("TESTING") == "True"

    if is_testing:
        # Check if already initialized to return real one if someone initialized it manually
        if firebase_admin._apps:
            return firestore.client()
        return MagicMock()

    # Return cached client if available
    if _db_cache is not None:
        return _db_cache

    if not firebase_admin._apps:
        # Tenta ler arquivo local (Dev)
        cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

        # Tenta ler JSON direto da variável (Prod/Render)
        json_creds = os.getenv("FIREBASE_CREDENTIALS_JSON")

        try:
            # Garante o Project ID para o Auth Service
            project_id = os.getenv("PROJECT_ID", "ccat-monfintrack")

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
                    "projectId": project_id,
                    "storageBucket": os.getenv(
                        "STORAGE_BUCKET", f"{project_id}.firebasestorage.app"
                    ),
                },
            )
            logger.info(
                "✅ Conexão com Firebase (%s) inicializada com sucesso!", project_id
            )
        except Exception as e:
            logger.error(
                "❌ ERRO CRÍTICO: Não foi possível inicializar o Firebase: %s",
                e,
                exc_info=True,
            )
            # Em produção, queremos saber exatamente o que falhou
            if not is_testing:
                # Mantemos o erro para ser capturado no get_db
                pass

    try:
        if not firebase_admin._apps:
            raise Exception("Firebase Admin SDK não foi inicializado (sem apps).")

        # Cache the client instance
        _db_cache = firestore.client()
        return _db_cache
    except Exception as e:
        if not is_testing:
            logger.error("❌ Erro ao obter cliente do Firestore: %s", e, exc_info=True)
            raise e  # Raise to let health check catch it
        return MagicMock() if is_testing else None
