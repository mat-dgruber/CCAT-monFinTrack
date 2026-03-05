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
    if "PYTEST_CURRENT_TEST" in os.environ or os.getenv("TESTING") == "True":
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
                cred_dict = json.loads(json_creds)
                cred = credentials.Certificate(cred_dict)
                logger.info("Usando credenciais da variável FIREBASE_CREDENTIALS_JSON")
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
            logger.info("Conexão com Firestore estabelecida!")
        except Exception as e:
            logger.warning("Could not initialize Firestore: %s", e)
            return MagicMock()

    return firestore.client()


# db global instance
db = get_db()
