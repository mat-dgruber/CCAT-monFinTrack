from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware 
from app.core.database import get_db
from app.api.routes import router as api_router 

app = FastAPI()

# --- CONFIGURAÇÃO DO CORS (LIBERAR O FRONTEND) ---
origins = [
    "http://localhost:4200",      # Frontend Angular
    "http://127.0.0.1:4200",      # Variação do localhost
]

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