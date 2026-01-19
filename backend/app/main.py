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
# Custom Middleware to handle specific dev scenarios and avoid "No Access-Control-Allow-Origin"
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Response

origins = [
    "http://localhost:4200",
    "http://localhost",
    "http://127.0.0.1",
    "http://127.0.0.1:4200",
    "https://ccat-monfintrack.web.app",
    "https://ccat-monfintrack.firebaseapp.com"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Adicional: Middleware de debug para garantir headers em 500s ou falhas de preflight obscuras
@app.middleware("http")
async def add_cors_headers(request: Request, call_next):
    try:
        response = await call_next(request)
    except Exception as e:
        # Em caso de crash severo, garanta que o client receba erro legível e headers
        print(f"❌ Unhandled Exception: {e}")
        response = Response("Internal Server Error", status_code=500)

    origin = request.headers.get("Origin")
    if origin and (origin in origins or "localhost" in origin):
        # Force headers if missing (sometimes 500s strip them)
        if "Access-Control-Allow-Origin" not in response.headers:
            response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
    
    return response

# --- CRITICAL: FIX HTTPS REDIRECTS ON CLOUD RUN ---
# Diga ao FastAPI que ele está atrás de um proxy HTTPS (Cloud Run/Firebase)
# Isso evita redirects para http:// e erros de Mixed Content
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=["*"])
# --------------------------------------------------


#  Adicione as rotas ao app principal
app.include_router(api_router, prefix="/api")

# AI Router (Novo)
from app.api.routers import ai, import_transactions, analysis, attachments
app.include_router(ai.router, prefix="/api/ai", tags=["AI"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["Analysis"])
app.include_router(import_transactions.router, prefix="/api/import", tags=["Import"])
app.include_router(attachments.router, prefix="/api/attachments", tags=["Attachments"])

from app.api.routers import stripe
app.include_router(stripe.router, prefix="/api/stripe", tags=["Stripe"])

from app.api.calculator import router as calculator_router
app.include_router(calculator_router, prefix="/api", tags=["Calculator"])

from app.api.debts import router as debt_router
app.include_router(debt_router, prefix="/api")

from app.api.resources import router as resources_router
app.include_router(resources_router)

from app.api.jobs import router as jobs_router
app.include_router(jobs_router, prefix="/api/jobs", tags=["Jobs"])

from fastapi.staticfiles import StaticFiles
import os

# Mount Static Files
os.makedirs("app/static/profile_images", exist_ok=True)
os.makedirs("app/static/attachments", exist_ok=True)
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