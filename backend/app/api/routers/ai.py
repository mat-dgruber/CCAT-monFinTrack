from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from app.services import ai_service
from app.core.rate_limiter import limiter
from typing import Optional

router = APIRouter()

from app.core.security import get_current_user

class ClassificationRequest(BaseModel):
    description: str

class ClassificationResponse(BaseModel):
    category_id: Optional[str]

@router.post("/classify", response_model=ClassificationResponse)
def classify_endpoint(request: ClassificationRequest, current_user: dict = Depends(get_current_user)):
    # 1. Check Rate Limit
    limiter.check_limit(current_user['uid'], 'classify')
    """
    Recebe uma descrição e retorna o ID da categoria sugerida pela IA.
    """
    if not request.description:
        raise HTTPException(status_code=400, detail="Description is required")

    category_id = ai_service.classify_transaction(request.description, current_user['uid'])
    
    return ClassificationResponse(category_id=category_id)

class ChatRequest(BaseModel):
    message: str
    persona: Optional[str] = 'friendly'

class ChatResponse(BaseModel):
    response: str

@router.post("/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest, current_user: dict = Depends(get_current_user)):
    """
    Endpoint para conversar com o assistente financeiro.
    """
    if not request.message:
        raise HTTPException(status_code=400, detail="Message is required")

    # 1. Check Rate Limit
    limiter.check_limit(current_user['uid'], 'chat')
        
    response_text = ai_service.chat_finance(request.message, current_user['uid'], persona=request.persona or 'friendly')
    
    return ChatResponse(response=response_text)

class ScanResponse(BaseModel):
    title: Optional[str]
    amount: Optional[float]
    date: Optional[str]
    category_id: Optional[str]

@router.post("/scan", response_model=ScanResponse)
async def scan_receipt_endpoint(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """
    Recebe uma imagem de comprovante e retorna os dados extraídos.
    """
    # 1. Check Rate Limit
    # Scan é mais caro, talvez um limite menor? Usando 'classify' por enquanto ou novo 'scan'.
    # Vamos usar 'classify' como proxy ou criar um novo se precisar. 
    # Para simplificar: conta como 1 classify.
    limiter.check_limit(current_user['uid'], 'classify')
    
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
        
    content = await file.read()
    
    result = ai_service.parse_receipt(content, file.content_type, current_user['uid'])
    
    if not result:
        raise HTTPException(status_code=500, detail="Could not parse receipt")
        
    return ScanResponse(**result)

@router.get("/report")
def generate_report(month: int, year: int, current_user: dict = Depends(get_current_user)):
    # 1. Check Rate Limit
    limiter.check_limit(current_user['uid'], 'chat') # Use chat quota for now
    
    return {"content": ai_service.generate_monthly_report(current_user['uid'], month, year)}
