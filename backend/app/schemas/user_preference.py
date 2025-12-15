from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class UserPreferenceBase(BaseModel):
    language: Optional[str] = "pt-BR"
    theme: Optional[str] = "light" # light, dark
    notifications_enabled: Optional[bool] = True
    profile_image_url: Optional[str] = None
    birthday: Optional[datetime] = None
    timezone: Optional[str] = "Europe/Paris"
    
    # Tithes & Offerings
    enable_tithes_offerings: Optional[bool] = False
    default_tithe_percentage: Optional[float] = 10.0
    default_offering_percentage: Optional[float] = 5.0
    auto_apply_tithe: Optional[bool] = False
    auto_apply_offering: Optional[bool] = False

class UserPreferenceCreate(UserPreferenceBase):
    pass

class UserPreference(UserPreferenceBase):
    user_id: str
    version: int = 1
    updated_at: datetime

    class Config:
        from_attributes = True
