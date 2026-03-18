from app.core.logger import get_logger
from app.core.security import get_current_user
from app.schemas.user_preference import UserPreference, UserPreferenceCreate
from app.services import user_preference as preference_service
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

router = APIRouter()


@router.get("", response_model=UserPreference)
def get_my_preferences(current_user: dict = Depends(get_current_user)):
    user_id = current_user["uid"]
    import time
    logger = get_logger(__name__)
    start_time = time.time()
    prefs = preference_service.get_preferences(user_id)
    duration = time.time() - start_time
    if duration > 1.0:  # Log as warning if takes more than 1s
        logger.warning(f"PERF: get_preferences for {user_id} took {duration:.2f}s")
    else:
        logger.info(f"PERF: get_preferences for {user_id} took {duration:.2f}s")
    return prefs


@router.put("", response_model=UserPreference)
def update_my_preferences(
    preference_in: UserPreferenceCreate, current_user: dict = Depends(get_current_user)
):
    user_id = current_user["uid"]
    return preference_service.update_preferences(user_id, preference_in)


@router.post("/avatar")
def upload_avatar(
    file: UploadFile = File(...), current_user: dict = Depends(get_current_user)
):
    user_id = current_user["uid"]

    # Basic validation
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    url = preference_service.save_profile_image(user_id, file)

    # Update the user preference with the new URL
    preference_service.update_preferences(
        user_id, UserPreferenceCreate(profile_image_url=url)
    )

    return {"url": url}


@router.post("/reset")
def reset_account(current_user: dict = Depends(get_current_user)):
    user_id = current_user["uid"]
    return preference_service.reset_account(user_id)
