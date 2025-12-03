from google.cloud import firestore
from app.core.database import get_db
from app.schemas.recurrence import RecurrenceCreate, RecurrenceUpdate, Recurrence
from app.core.date_utils import calculate_next_due_date
from fastapi import HTTPException
from typing import List, Optional
from datetime import datetime

COLLECTION_NAME = "recurrences"

def create_recurrence(recurrence_in: RecurrenceCreate, user_id: str) -> Recurrence:
    db = get_db()
    
    data = recurrence_in.model_dump()
    data['user_id'] = user_id
    data['created_at'] = datetime.now()
    data['last_processed_at'] = None
    data['cancellation_date'] = None
    
    # Convert Enum to string for Firestore
    if 'periodicity' in data:
        data['periodicity'] = data['periodicity'].value
        
    update_time, recurrence_ref = db.collection(COLLECTION_NAME).add(data)
    
    return Recurrence(id=recurrence_ref.id, **data)

def get_recurrence(recurrence_id: str, user_id: str) -> Optional[Recurrence]:
    db = get_db()
    doc_ref = db.collection(COLLECTION_NAME).document(recurrence_id)
    doc = doc_ref.get()
    
    if not doc.exists or doc.to_dict().get('user_id') != user_id:
        return None
        
    return Recurrence(id=doc.id, **doc.to_dict())

def list_recurrences(user_id: str, active_only: bool = False) -> List[Recurrence]:
    db = get_db()
    query = db.collection(COLLECTION_NAME).where("user_id", "==", user_id)
    
    if active_only:
        query = query.where("active", "==", True)
        
    docs = query.stream()
    results = []
    for doc in docs:
        try:
            results.append(Recurrence(id=doc.id, **doc.to_dict()))
        except Exception as e:
            print(f"Error parsing recurrence {doc.id}: {e}")
            # Optionally continue or raise. For debugging, printing is good.
            # If we want to avoid 500 for the user, we can skip the bad record:
            continue
            
    return results

def update_recurrence(recurrence_id: str, recurrence_in: RecurrenceUpdate, user_id: str, scope: str = "all") -> Recurrence:
    db = get_db()
    doc_ref = db.collection(COLLECTION_NAME).document(recurrence_id)
    doc = doc_ref.get()
    
    if not doc.exists or doc.to_dict().get('user_id') != user_id:
        raise HTTPException(status_code=404, detail="Recurrence not found")
        
    current_data = doc.to_dict()
    
    # If scope is "future", we cancel the current one and create a new one
    if scope == "future":
        # 1. Cancel current recurrence
        now = datetime.now()
        doc_ref.update({
            "active": False,
            "cancellation_date": now.date().isoformat()
        })
        
        # 2. Create new recurrence with updated data
        new_data = current_data.copy()
        # Remove system fields that should be reset
        new_data.pop('id', None)
        new_data.pop('created_at', None)
        new_data.pop('cancellation_date', None)
        
        # Apply updates
        update_data = recurrence_in.model_dump(exclude_unset=True)
        if 'periodicity' in update_data and update_data['periodicity']:
            update_data['periodicity'] = update_data['periodicity'].value
            
        new_data.update(update_data)
        
        # Set new creation date and ensure active
        new_data['created_at'] = now
        new_data['active'] = True
        
        # Create the new document
        _, new_ref = db.collection(COLLECTION_NAME).add(new_data)
        
        return Recurrence(id=new_ref.id, **new_data)

    # Default "all": update in place
    data = recurrence_in.model_dump(exclude_unset=True)
    
    if 'periodicity' in data and data['periodicity']:
        data['periodicity'] = data['periodicity'].value
        
    doc_ref.update(data)
    
    updated_doc = doc_ref.get()
    return Recurrence(id=updated_doc.id, **updated_doc.to_dict())

def cancel_recurrence(recurrence_id: str, user_id: str) -> Recurrence:
    """
    Soft delete: marca como inativo e define data de cancelamento.
    """
    db = get_db()
    doc_ref = db.collection(COLLECTION_NAME).document(recurrence_id)
    doc = doc_ref.get()
    
    if not doc.exists or doc.to_dict().get('user_id') != user_id:
        raise HTTPException(status_code=404, detail="Recurrence not found")
        
    update_data = {
        "active": False,
        "cancellation_date": datetime.now().date().isoformat() # Store as string or timestamp? Firestore handles datetime.
        # Let's stick to datetime object if possible, but Recurrence schema expects date.
        # Firestore stores datetime. Let's use datetime.now() for simplicity in DB, schema will parse.
    }
    # Actually schema has cancellation_date as date. 
    # Let's store as datetime in DB to be safe, or string. 
    # Firestore supports Timestamp.
    
    doc_ref.update({
        "active": False,
        "cancellation_date": datetime.now().date().isoformat()
    })
    
    updated_doc = doc_ref.get()
    return Recurrence(id=updated_doc.id, **updated_doc.to_dict())

def delete_all_recurrences(user_id: str):
    db = get_db()
    docs = db.collection(COLLECTION_NAME).where("user_id", "==", user_id).stream()
    
    batch = db.batch()
    count = 0
    deleted_count = 0
    
    for doc in docs:
        batch.delete(doc.reference)
        count += 1
        
        if count >= 400:
            batch.commit()
            batch = db.batch()
            deleted_count += count
            count = 0
            
    if count > 0:
        batch.commit()
        deleted_count += count
        
    return deleted_count
