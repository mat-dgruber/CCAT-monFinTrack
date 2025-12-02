import os
import shutil
from fastapi import UploadFile
from app.core.database import get_db
from app.schemas.user_preference import UserPreference, UserPreferenceCreate
from datetime import datetime

COLLECTION_NAME = "user_preferences"
STATIC_DIR = "app/static/profile_images"

def get_preferences(user_id: str) -> UserPreference:
    db = get_db()
    doc_ref = db.collection(COLLECTION_NAME).document(user_id)
    doc = doc_ref.get()

    if doc.exists:
        return UserPreference(**doc.to_dict())
    
    # Return defaults if not exists
    default_pref = UserPreference(
        user_id=user_id,
        updated_at=datetime.now(),
        version=1
    )
    # Save default to DB so we have a record
    doc_ref.set(default_pref.model_dump())
    return default_pref

def update_preferences(user_id: str, data: UserPreferenceCreate) -> UserPreference:
    db = get_db()
    doc_ref = db.collection(COLLECTION_NAME).document(user_id)
    doc = doc_ref.get()

    current_data = doc.to_dict() if doc.exists else {}
    
    # Increment version
    new_version = current_data.get("version", 0) + 1
    
    # Prepare update data
    update_data = data.model_dump(exclude_unset=True)
    update_data["version"] = new_version
    update_data["updated_at"] = datetime.now()
    update_data["user_id"] = user_id

    # Merge with existing to ensure we don't lose fields if partial update (though Pydantic handles this via exclude_unset usually, but here we are explicit)
    # Actually, for a full update or partial, we merge.
    
    doc_ref.set(update_data, merge=True)
    
    # Fetch full updated doc to return
    return UserPreference(**doc_ref.get().to_dict())

def save_profile_image(user_id: str, file: UploadFile) -> str:
    # Ensure directory exists
    os.makedirs(STATIC_DIR, exist_ok=True)
    
    # Define file path: user_id.jpg (or original extension)
    # For simplicity, we can force jpg or keep original extension.
    # Let's keep it simple and use the user_id as filename to avoid clutter.
    extension = os.path.splitext(file.filename)[1]
    filename = f"{user_id}{extension}"
    file_path = os.path.join(STATIC_DIR, filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Return the relative URL
    # Assuming we mount /static at root or /api/static
    return f"/static/profile_images/{filename}"
