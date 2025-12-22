from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from typing import Optional
import os
import uuid
import shutil
from app.core.security import get_current_user
from app.services import user_preference as preference_service

router = APIRouter()

@router.post("/upload")
async def upload_attachment(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    user_id = current_user['uid']
    prefs = preference_service.get_preferences(user_id)
    
    # Check quota or tier if needed (optional)
    
    if not file.content_type.startswith("image/") and not file.content_type.startswith("application/pdf"):
         # For now, allow basic types
         pass
         
    try:
        file_ext = file.filename.split('.')[-1] if '.' in file.filename else "bin"
        filename = f"{uuid.uuid4()}.{file_ext}"
        
        # Ensure directory exists
        save_dir = "app/static/attachments"
        os.makedirs(save_dir, exist_ok=True)
        
        file_path = os.path.join(save_dir, filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        return {"url": f"/static/attachments/{filename}"}
        
    except Exception as e:
        print(f"Upload Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload file")
