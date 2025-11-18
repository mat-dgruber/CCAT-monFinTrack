import firebase_admin
from firebase_admin import credentials, firestore
import os

# O caminho para o arquivo JSON
CRED_PATH = "app/certs/serviceAccountKey.json"

def get_db():
    """
    Inicializa a conexão com o Firebase Firestore se ainda não existir
    e retorna o cliente do banco de dados.
    """
    try:
        # Usamos '_apps' (com underscore) para checar se já existe
        if not firebase_admin._apps:
            if os.path.exists(CRED_PATH):
                cred = credentials.Certificate(CRED_PATH)
                firebase_admin.initialize_app(cred)
                print("✅ Conexão com Firestore estabelecida com sucesso!")
            else:
                print(f"❌ Erro: Arquivo de credencial não encontrado em: {CRED_PATH}")
                return None

        return firestore.client()
        
    except Exception as e:
        print(f"❌ Erro ao conectar ao Firestore: {e}")
        return None