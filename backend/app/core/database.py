import firebase_admin
from firebase_admin import credentials, firestore
import os
import json # <--- Importe json
from dotenv import load_dotenv # <--- Importe

# Carrega as variáveis do arquivo .env
load_dotenv()

def get_db():
    if not firebase_admin._apps:
        # Tenta ler arquivo local (Dev)
        cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        
        # Tenta ler JSON direto da variável (Prod/Render)
        json_creds = os.getenv("FIREBASE_CREDENTIALS_JSON")

        if cred_path and os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
        elif json_creds:
            try:
                # Se estiver no Render, cria a credencial a partir do dicionário
                cred_dict = json.loads(json_creds)
                cred = credentials.Certificate(cred_dict)
            except json.JSONDecodeError as e:
                print(f"❌ Erro ao decodificar FIREBASE_CREDENTIALS_JSON: {e}")
                raise ValueError("Environment variable FIREBASE_CREDENTIALS_JSON is not valid JSON")
        else:
            print("❌ Erro: Nenhuma credencial encontrada (GOOGLE_APPLICATION_CREDENTIALS ou FIREBASE_CREDENTIALS_JSON).")
            raise ValueError("No Firebase credentials found.")

        firebase_admin.initialize_app(cred, {
            'storageBucket': os.getenv("STORAGE_BUCKET", "ccat-monfintrack.firebasestorage.app")
        })
        print("✅ Conexão com Firestore estabelecida!")
        
    return firestore.client()

db = get_db()