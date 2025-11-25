from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os

from app.core.database import get_db
from app.api.routes import router as api_router
from app.core.limiter import limiter

# Inicializa o Limitador (usa o IP do usuário como chave)
limiter = Limiter(key_func=get_remote_address)

app = FastAPI()

# Conecta o limitador ao App
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler) 
# --- CONFIGURAÇÃO DO CORS (LIBERAR O FRONTEND) ---
# Pega origens do .env OU usa uma lista padrão segura
origins_str = os.getenv("ALLOWED_ORIGINS", "http://localhost:4200,http://localhost,http://127.0.0.1,http://127.0.0.1:4200")
origins = origins_str.split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,        # Quem pode acessar
    allow_credentials=True,
    allow_methods=["*"],          # Quais métodos (GET, POST, etc)
    allow_headers=["*"],          # Quais cabeçalhos
)
# -------------------------------------------------


#  Adicione as rotas ao app principal
app.include_router(api_router, prefix="/api")

@app.on_event("startup")
async def startup_event():
     db = get_db()
     if db:
          print("✅ Conexão com Firestore estabelecida com sucesso!")
     else:
          print("❌ Erro ao conectar ao Firestore.")


@app.get("/")
def read_root():
     return {"mensagem":"Olá, Mundo!"}