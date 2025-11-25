import firebase_admin
from firebase_admin import credentials, firestore
import os
from dotenv import load_dotenv # <--- Importe

# Carrega as variáveis do arquivo .env
load_dotenv()

def get_db():
    try:
        if not firebase_admin._apps:
            # Pega o caminho da variável de ambiente
            cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
            
            if cred_path and os.path.exists(cred_path):
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred)
                print("✅ Conexão com Firestore estabelecida!")
            else:
                # Fallback ou Erro
                print(f"❌ Erro: Credencial não encontrada em {cred_path}")
                return None

        return firestore.client()
        
    except Exception as e:
        print(f"❌ Erro ao conectar no Firestore: {e}")
        return None