from fastapi import FastAPI
from app.core.database import get_db
# 1. Importe o arquivo de rotas
from app.api.routes import router as api_router 

app = FastAPI()

# 2. Adicione as rotas ao app principal
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