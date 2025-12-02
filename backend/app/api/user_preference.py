from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from app.core.security import get_current_user
from app.schemas.user_preference import UserPreference, UserPreferenceCreate
from app.services import user_preference as preference_service

router = APIRouter()

@router.get("/", response_model=UserPreference)
def get_my_preferences(current_user: dict = Depends(get_current_user)):
    user_id = current_user['uid']
    return preference_service.get_preferences(user_id)

@router.put("/", response_model=UserPreference)
def update_my_preferences(
    preference_in: UserPreferenceCreate,
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user['uid']
    return preference_service.update_preferences(user_id, preference_in)

@router.post("/avatar")
def upload_avatar(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user['uid']
    
    # Basic validation
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
        
    url = preference_service.save_profile_image(user_id, file)
    
    # Update the user preference with the new URL
    preference_service.update_preferences(user_id, UserPreferenceCreate(profile_image_url=url))
    
    return {"url": url}
