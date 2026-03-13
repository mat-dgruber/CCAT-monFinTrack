import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app.api.calculator import router as calculator_router
from app.api.debts import router as debt_router
from app.api.indicators import router as indicators_router
from app.api.jobs import router as jobs_router
from app.api.resources import router as resources_router
from app.api.routes import router as api_router
from app.api.routers import ai, analysis, attachments, import_transactions, stripe
from app.core.database import get_db
from app.core.limiter import limiter
from app.core.logger import get_logger

load_dotenv()

logger = get_logger(__name__)
app = FastAPI()

# Conecta o limitador ao App
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- CONFIGURAÇÃO DO CORS (LIBERAR O FRONTEND) ---
# Custom Middleware to handle specific dev scenarios and avoid "No Access-Control-Allow-Origin"

origins = [
    "http://localhost:4200",
    "http://localhost",
    "http://127.0.0.1",
    "http://127.0.0.1:4200",
    "https://monfintrack.com.br",
    "https://www.monfintrack.com.br",
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
    except HTTPException as http_exc:
        # Deixe o FastAPI tratar HTTPExceptions (ele vai converter para resposta)
        # Mas para o middleware continuar, precisamos gerar a resposta aqui
        # ou deixar o erro propagar e tratar no exception_handler.
        # No entanto, call_next geralmente não deve ser envolvido em try/except
        # se quisermos que os handlers de exceção do FastAPI funcionem.
        # A melhor prática é NÃO ter try/except em volta de call_next se você quer os handlers de erro.
        raise http_exc
    except Exception as e:
        logger.error("Unhandled Exception in Middleware: %s", e, exc_info=True)
        # Se for um erro real não tratado, retornamos 500
        response = JSONResponse(
            status_code=500,
            content={"detail": "Internal Server Error", "error": str(e)},
        )

    origin = request.headers.get("Origin")
    if origin and origin in origins:
        if "Access-Control-Allow-Origin" not in response.headers:
            response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"

    return response


# --- CRITICAL: FIX HTTPS REDIRECTS ON CLOUD RUN ---
# Diga ao FastAPI que ele está atrás de um proxy HTTPS (Cloud Run/Firebase)
# Isso evita redirects para http:// e erros de Mixed Content
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=["*"])
# --------------------------------------------------


#  Adicione as rotas ao app principal
app.include_router(api_router, prefix="/api")

# AI Routers
app.include_router(ai.router, prefix="/api/ai", tags=["AI"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["Analysis"])
app.include_router(import_transactions.router, prefix="/api/import", tags=["Import"])
app.include_router(attachments.router, prefix="/api/attachments", tags=["Attachments"])
app.include_router(stripe.router, prefix="/api/stripe", tags=["Stripe"])

# Other Routers
app.include_router(calculator_router, prefix="/api", tags=["Calculator"])
app.include_router(debt_router, prefix="/api")
app.include_router(resources_router)
app.include_router(indicators_router)
app.include_router(jobs_router, prefix="/api/jobs", tags=["Jobs"])

# Mount Static Files
os.makedirs("app/static/profile_images", exist_ok=True)
os.makedirs("app/static/attachments", exist_ok=True)
app.mount("/static", StaticFiles(directory="app/static"), name="static")


@app.on_event("startup")
async def startup_event():
    try:
        get_db()
        logger.info("Conexão com Firestore estabelecida com sucesso na inicialização!")
    except Exception as e:
        logger.critical("Erro CRÍTICO ao conectar ao Firestore na inicialização: %s", e)
        # Não vamos crashar o app aqui para permitir que /health responda,
        # mas rotas que usam DB vão falhar.


@app.get("/health")
def health_check():
    try:
        get_db()
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Database connection error: {str(e)}"
        ) from e


@app.get("/")
def read_root():
    return {"mensagem": "Olá, Mundo!"}
