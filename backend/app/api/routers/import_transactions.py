from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel
from app.utils.parsers import parse_ofx, parse_csv
from app.services import ai_service
from app.core.security import get_current_user

router = APIRouter()

class DraftTransaction(BaseModel):
    date: str
    description: str
    amount: float
    type: str # income / expense
    category_id: Optional[str] = None
    source: str # ofx / csv

@router.post("/preview", response_model=List[DraftTransaction])
async def preview_import(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    user_id = current_user['uid']
    # Tier Check (Pro+)
    from app.services import user_preference as preference_service
    prefs = preference_service.get_preferences(user_id)
    tier = prefs.subscription_tier or 'free'
    
    if tier == 'free':
        raise HTTPException(status_code=403, detail="Transaction Import is available for Pro and Premium users.")
    
    """
    Receives a file (OFX or CSV), parses it, and auto-categorizes transactions using AI.
    Returns a list of DraftTransactions for the user to review.
    """
    filename = file.filename.lower()
    content = await file.read()
    
    transactions = []
    
    # 1. Parse File
    if filename.endswith('.ofx'):
        transactions = parse_ofx(content)
    elif filename.endswith('.csv'):
        transactions = parse_csv(content)
    else:
        raise HTTPException(status_code=400, detail="Unsupported file format. Please upload .ofx or .csv")
        
    if not transactions:
        raise HTTPException(status_code=400, detail="Could not parse transactions from file.")
        
    # 2. Auto-Categorize (AI)
    # Note: Doing this in loop might be slow for large files. 
    # Ideal: Batch API or parallel tasks. For MVP, we do sequential or limit to N.
    
    drafts = []
    for tx in transactions:
        # Suggest Category using AI
        cat_id = None
        if tx['type'] == 'expense': # Usually only categorize expenses
             cat_id = ai_service.classify_transaction(tx['description'], current_user['uid'])
             
        drafts.append(DraftTransaction(
            date=tx['date'],
            description=tx['description'],
            amount=abs(tx['amount']), # Front prefers absolute for table? Let's keep raw or abs? Usually separate columns.
            # Let's keep signed? Or explicit type.
            # The parser sets 'type'. Let's use absolute amount for display usually.
            type=tx['type'],
            category_id=cat_id,
            source=tx['source']
        ))
        
    return drafts
