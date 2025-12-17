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
# Pega origens do .env
env_origins_str = os.getenv("ALLOWED_ORIGINS", "")
env_origins = [origin.strip() for origin in env_origins_str.split(",") if origin.strip()]

# Lista de origens padrão (sempre permitidas)
default_origins = [
    "http://localhost:4200",
    "http://localhost",
    "http://127.0.0.1",
    "http://127.0.0.1:4200",
    "https://ccat-monfintrack.web.app",
    "https://ccat-monfintrack.web.app/",
    "https://ccat-monfintrack.firebaseapp.com"
]

# Combina as listas (removendo duplicatas)
origins = list(set(env_origins + default_origins))
print(f"Allowed origins: {origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,          # Use specific origins
    allow_credentials=True,
    allow_methods=["*"],          # Quais métodos (GET, POST, etc)
    allow_headers=["*"],          # Quais cabeçalhos
)
# -------------------------------------------------


#  Adicione as rotas ao app principal
app.include_router(api_router, prefix="/api")

# AI Router (Novo)
from app.api.routers import ai, import_transactions, analysis
app.include_router(ai.router, prefix="/api/ai", tags=["AI"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["Analysis"])
app.include_router(import_transactions.router, prefix="/api/import", tags=["Import"])

from fastapi.staticfiles import StaticFiles
import os

# Mount Static Files
os.makedirs("app/static/profile_images", exist_ok=True)
app.mount("/static", StaticFiles(directory="app/static"), name="static")


@app.on_event("startup")
async def startup_event():
     try:
         db = get_db()
         print("✅ Conexão com Firestore estabelecida com sucesso na inicialização!")
     except Exception as e:
         print(f"❌ Erro CRÍTICO ao conectar ao Firestore na inicialização: {e}")
         # Não vamos crashar o app aqui para permitir que /health responda,
         # mas rotas que usam DB vão falhar.

@app.get("/health")
def health_check():
    try:
        get_db()
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection error: {str(e)}")


@app.get("/")
def read_root():
     return {"mensagem":"Olá, Mundo!"}