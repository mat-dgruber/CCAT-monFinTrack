from pydantic import BaseModel, Field
from typing import Optional

class CheckoutSessionCreate(BaseModel):
    plan: str = Field(..., description="Plan ID ('pro_monthly', 'pro_yearly', 'premium_monthly', 'premium_yearly')")
    success_url: str
    cancel_url: str

class PortalSessionCreate(BaseModel):
    return_url: str

class StripeConfigResponse(BaseModel):
    publishable_key: str
