from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
from firebase_admin import firestore
from app.core.database import db
from app.schemas.seasonal_income import SeasonalIncome, SeasonalIncomeCreate, SeasonalIncomeUpdate
import uuid

router = APIRouter(prefix="/api/resources", tags=["Resources"])

# Mock User dependency (replace with real auth in prod)
def get_current_user_id():
    return "test_user_id" 

@router.get("/", response_model=List[SeasonalIncome])
def list_resources(user_id: str = Depends(get_current_user_id)):
    """Listar todos os recursos sazonais do usuário"""
    resources_ref = db.collection('seasonal_incomes').where('user_id', '==', user_id)
    docs = resources_ref.stream()
    
    resources = []
    for doc in docs:
        data = doc.to_dict()
        data['id'] = doc.id
        resources.append(data)
        
    # Sort by date
    resources.sort(key=lambda x: x.get('receive_date', ''))
    return resources

@router.post("/", response_model=SeasonalIncome, status_code=status.HTTP_201_CREATED)
def create_resource(resource: SeasonalIncomeCreate, user_id: str = Depends(get_current_user_id)):
    """Cadastrar novo recurso sazonal"""
    new_id = str(uuid.uuid4())
    data = resource.dict()
    data['user_id'] = user_id
    # Convert date to string/timestamp for Firestore if needed, but Pydantic handles serializaton mostly.
    # Firestore stores dates as Timestamps usually, but using `isoformat` is safer for simple JSON.
    # However, firebase-admin handles datetime objects well.
    # Let's keep it simple: store as string YYYY-MM-DD for consistency with frontend JSON or native Date.
    # Pydantic .dict() gives `date` object.
    # Let's ensure it's compatible. firebase-admin accepts native python datetime/date.
    
    # But wait, date objects in python are not directly JSON serializable if we use simple json dumps.
    # However, Firestore client handles it.
    
    # Converting date to string for safer storage/retrieval consistency across other endpoints
    data['receive_date'] = data['receive_date'].isoformat()
    
    db.collection('seasonal_incomes').document(new_id).set(data)
    
    return {**data, "id": new_id}

@router.put("/{resource_id}", response_model=SeasonalIncome)
def update_resource(resource_id: str, update_data: SeasonalIncomeUpdate, user_id: str = Depends(get_current_user_id)):
    doc_ref = db.collection('seasonal_incomes').document(resource_id)
    doc = doc_ref.get()
    
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Resource not found")
        
    existing_data = doc.to_dict()
    if existing_data.get('user_id') != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    update_dict = update_data.dict(exclude_unset=True)
    if 'receive_date' in update_dict:
        update_dict['receive_date'] = update_dict['receive_date'].isoformat()
        
    doc_ref.update(update_dict)
    
    updated_doc = doc_ref.get().to_dict()
    updated_doc['id'] = resource_id
    return updated_doc

@router.delete("/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_resource(resource_id: str, user_id: str = Depends(get_current_user_id)):
    doc_ref = db.collection('seasonal_incomes').document(resource_id)
    doc = doc_ref.get()
    
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Resource not found")
        
    if doc.to_dict().get('user_id') != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    doc_ref.delete()
    return None
