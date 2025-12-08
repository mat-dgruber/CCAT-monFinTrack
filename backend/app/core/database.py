import firebase_admin
from firebase_admin import credentials, firestore
import os
import json # <--- Importe json
from dotenv import load_dotenv # <--- Importe

# Carrega as variáveis do arquivo .env
load_dotenv()

def get_db():
    try:
        if not firebase_admin._apps:
            # Tenta ler arquivo local (Dev)
            cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
            
            # Tenta ler JSON direto da variável (Prod/Render)
            json_creds = os.getenv("FIREBASE_CREDENTIALS_JSON")

            if cred_path and os.path.exists(cred_path):
                cred = credentials.Certificate(cred_path)
            elif json_creds:
                # Se estiver no Render, cria a credencial a partir do dicionário
                cred_dict = json.loads(json_creds)
                cred = credentials.Certificate(cred_dict)
            else:
                print("❌ Erro: Nenhuma credencial encontrada.")
                return None

            firebase_admin.initialize_app(cred)
            print("✅ Conexão com Firestore estabelecida!")
            
        return firestore.client()
    except Exception as e:
        print(f"Erro DB: {e}")
        return None