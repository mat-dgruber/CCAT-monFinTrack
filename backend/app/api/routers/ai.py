from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from app.services import ai_service
from app.services import user_preference as preference_service
from app.core.rate_limiter import limiter
from typing import Optional, List

router = APIRouter()

from app.core.security import get_current_user

class ClassificationRequest(BaseModel):
    description: str

class ClassificationResponse(BaseModel):
    category_id: Optional[str]

@router.post("/classify", response_model=ClassificationResponse)
def classify_endpoint(request: ClassificationRequest, current_user: dict = Depends(get_current_user)):
    user_id = current_user['uid']
    prefs = preference_service.get_preferences(user_id)
    tier = prefs.subscription_tier or 'free'

    # 1. Check Rate Limit
    limiter.check_limit(user_id, 'classify', tier)

    """
    Recebe uma descrição e retorna o ID da categoria sugerida pela IA.
    """
    if not request.description:
        raise HTTPException(status_code=400, detail="Description is required")

    category_id = ai_service.classify_transaction(request.description, user_id)
    
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

    user_id = current_user['uid']
    prefs = preference_service.get_preferences(user_id)
    tier = prefs.subscription_tier or 'free'

    # 1. Check Feature Access & Rate Limit
    if tier == 'free':
        raise HTTPException(status_code=403, detail="Feature not available for Free plan.")

    limiter.check_limit(user_id, 'chat', tier)
        
    response_text = ai_service.chat_finance(request.message, user_id, tier=tier, persona=request.persona or 'friendly')
    
    return ChatResponse(response=response_text)

class ScanItem(BaseModel):
    description: str
    amount: float
    category_id: Optional[str]

class ScanResponse(BaseModel):
    title: Optional[str]
    amount: Optional[float]
    date: Optional[str]
    category_id: Optional[str]
    items: List[ScanItem] = []
    location: Optional[str] = None
    payment_method: Optional[str] = None
    account_id: Optional[str] = None

@router.post("/scan", response_model=ScanResponse)
async def scan_receipt_endpoint(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """
    Recebe uma imagem de comprovante e retorna os dados extraídos.
    """
    user_id = current_user['uid']
    prefs = preference_service.get_preferences(user_id)
    tier = prefs.subscription_tier or 'free'

    # 1. Check Rate Limit && Feature Access
    if tier == 'free':
         raise HTTPException(status_code=403, detail="Scanner not available for Free plan.")

    limiter.check_limit(user_id, 'classify', tier) # Uses classify quota
    
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
        
    content = await file.read()
    
    result = ai_service.parse_receipt(content, file.content_type, user_id, tier=tier)
    
    if not result:
        raise HTTPException(status_code=500, detail="Could not parse receipt")
        
    return ScanResponse(**result)

@router.get("/report")
def generate_report(month: int, year: int, current_user: dict = Depends(get_current_user)):
    user_id = current_user['uid']
    prefs = preference_service.get_preferences(user_id)
    tier = prefs.subscription_tier or 'free'
    
    # 1. Check Feature Access & Rate Limit
    if tier == 'free':
        raise HTTPException(status_code=403, detail="Reports not available for Free plan.")

    limiter.check_limit(user_id, 'chat', tier) # Use chat quota
    
    return {"content": ai_service.generate_monthly_report(user_id, month, year, tier=tier)}

class CostOfLivingAnalysisRequest(BaseModel):
    data: dict

@router.post("/cost-of-living-analysis")
def analyze_cost_of_living_endpoint(request: CostOfLivingAnalysisRequest, current_user: dict = Depends(get_current_user)):
    user_id = current_user['uid']
    prefs = preference_service.get_preferences(user_id)
    tier = prefs.subscription_tier or 'free'
    
    if tier != 'premium':
        raise HTTPException(status_code=403, detail="Feature exclusive for Premium users.")

    limiter.check_limit(user_id, 'chat', tier)
    
    analysis = ai_service.analyze_cost_of_living(user_id, request.data, tier=tier)
    return {"analysis": analysis}
