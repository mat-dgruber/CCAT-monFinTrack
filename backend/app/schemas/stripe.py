from pydantic import BaseModel, Field
from typing import Literal

class CheckoutSessionCreate(BaseModel):
    plan: Literal["pro_monthly", "pro_yearly", "premium_monthly", "premium_yearly"] = Field(
        ..., description="Plan ID"
    )
    success_url: str
    cancel_url: str

class PortalSessionCreate(BaseModel):
    return_url: str

class StripeConfigResponse(BaseModel):
    publishable_key: str
