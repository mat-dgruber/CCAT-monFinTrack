import uuid
from typing import List, Optional

from app.core.logger import get_logger
from app.core.rate_limiter import limiter
from app.services import ai_service
from app.services import user_preference as preference_service
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

logger = get_logger(__name__)

router = APIRouter()

from app.core.security import get_current_user


class LimitsResponse(BaseModel):
    classify: dict
    chat: dict
    tier: str


@router.get("/limits", response_model=LimitsResponse)
def get_limits(current_user: dict = Depends(get_current_user)):
    user_id = current_user["uid"]
    prefs = preference_service.get_preferences(user_id)
    tier = prefs.subscription_tier or "free"

    classify_info = limiter.get_usage_info(user_id, "classify", tier)
    chat_info = limiter.get_usage_info(user_id, "chat", tier)

    return LimitsResponse(classify=classify_info, chat=chat_info, tier=tier)


class ClassificationRequest(BaseModel):
    description: str


class ClassificationResponse(BaseModel):
    category_id: Optional[str]


@router.post("/classify", response_model=ClassificationResponse)
def classify_endpoint(
    request: ClassificationRequest, current_user: dict = Depends(get_current_user)
):
    user_id = current_user["uid"]
    prefs = preference_service.get_preferences(user_id)
    tier = prefs.subscription_tier or "free"

    # 1. Check Rate Limit
    limiter.check_limit(user_id, "classify", tier)

    """
    Recebe uma descrição e retorna o ID da categoria sugerida pela IA.
    """
    if not request.description:
        raise HTTPException(status_code=400, detail="Description is required")

    category_id = ai_service.classify_transaction(
        request.description, user_id, tier=tier
    )

    return ClassificationResponse(category_id=category_id)


class ChatRequest(BaseModel):
    message: str
    persona: Optional[str] = "friendly"


class ChatResponse(BaseModel):
    response: str


@router.post("/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest, current_user: dict = Depends(get_current_user)):
    """
    Endpoint para conversar com o assistente financeiro.
    """
    if not request.message:
        raise HTTPException(status_code=400, detail="Message is required")

    user_id = current_user["uid"]
    prefs = preference_service.get_preferences(user_id)
    tier = prefs.subscription_tier or "free"

    # 1. Check Feature Access & Rate Limit
    if tier == "free":
        raise HTTPException(
            status_code=403, detail="Feature not available for Free plan."
        )

    limiter.check_limit(user_id, "chat", tier)

    response_text = ai_service.chat_finance(
        request.message, user_id, tier=tier, persona=request.persona or "friendly"
    )

    return ChatResponse(response=response_text)


class ScanItem(BaseModel):
    description: str
    amount: float
    category_id: Optional[str]


class ScanResponse(BaseModel):
    title: Optional[str]
    amount: Optional[float]
    date: Optional[str]
    category_id: Optional[str]
    items: List[ScanItem] = []
    location: Optional[str] = None
    payment_method: Optional[str] = None
    account_id: Optional[str] = None
    description: Optional[str] = None
    attachment_url: Optional[str] = None


@router.post("/scan", response_model=ScanResponse)
async def scan_receipt_endpoint(
    file: Optional[UploadFile] = File(None),
    file_url: Optional[
        str
    ] = None,  # Expecting form field if multipart, or we need to separate endpoints?
    current_user: dict = Depends(get_current_user),
):
    """
    Recebe uma imagem de comprovante (UploadFile) OU uma URL local (file_url) e retorna os dados extraídos.
    """
    user_id = current_user["uid"]
    prefs = preference_service.get_preferences(user_id)
    tier = prefs.subscription_tier or "free"

    # 1. Check Rate Limit && Feature Access
    if tier == "free":
        raise HTTPException(
            status_code=403, detail="Scanner not available for Free plan."
        )

    limiter.check_limit(user_id, "classify", tier)  # Uses classify quota

    content = None
    content_type = "image/jpeg"  # Default fallback
    attachment_url = None

    # Scenario A: Uploaded File
    if file:
        if not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File must be an image")

        content = await file.read()
        content_type = file.content_type

        # Save file using StorageService
        file_ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
        filename = f"{uuid.uuid4()}.{file_ext}"

        from app.services.storage_service import storage_service

        try:
            attachment_url = storage_service.upload_file(
                file_content=content,
                filename=filename,
                folder="attachments",
                content_type=content_type,
            )
        except Exception as e:
            logger.error("Error saving file: %s", e)
            attachment_url = None

    # Scenario B: Existing File URL
    elif file_url:
        # Security: Prevent Directory Traversal
        # Ensure url starts with /static/attachments/ and contains no ..
        if not file_url.startswith("/static/attachments/") or ".." in file_url:
            raise HTTPException(status_code=400, detail="Invalid file path")

        from app.services.storage_service import storage_service

        try:
            content = storage_service.get_file_content(file_url)
            # Infer mime type? Simple check
            if file_url.lower().split("?")[0].endswith(".png"):
                content_type = "image/png"
            elif file_url.lower().split("?")[0].endswith(".pdf"):
                content_type = "application/pdf"
            else:
                content_type = "image/jpeg"

            attachment_url = file_url
        except Exception as e:
            logger.error("Error reading file: %s", e)
            raise HTTPException(status_code=500, detail="Could not read file")

    else:
        raise HTTPException(status_code=400, detail="Must provide 'file' or 'file_url'")

    result = ai_service.parse_receipt(content, content_type, user_id, tier=tier)

    if not result:
        raise HTTPException(status_code=500, detail="Could not parse receipt")

    if attachment_url:
        result["attachment_url"] = attachment_url

    return ScanResponse(**result)


@router.get("/report")
def generate_report(
    month: int, year: int, current_user: dict = Depends(get_current_user)
):
    user_id = current_user["uid"]
    prefs = preference_service.get_preferences(user_id)
    tier = prefs.subscription_tier or "free"

    # 1. Check Feature Access & Rate Limit
    if tier == "free":
        raise HTTPException(
            status_code=403, detail="Reports not available for Free plan."
        )

    limiter.check_limit(user_id, "chat", tier)  # Use chat quota

    return {
        "content": ai_service.generate_monthly_report(user_id, month, year, tier=tier)
    }


class CostOfLivingAnalysisRequest(BaseModel):
    data: dict


@router.post("/cost-of-living-analysis")
def analyze_cost_of_living_endpoint(
    request: CostOfLivingAnalysisRequest, current_user: dict = Depends(get_current_user)
):
    user_id = current_user["uid"]
    prefs = preference_service.get_preferences(user_id)
    tier = prefs.subscription_tier or "free"

    if tier != "premium":
        raise HTTPException(
            status_code=403, detail="Feature exclusive for Premium users."
        )

    limiter.check_limit(user_id, "chat", tier)

    analysis = ai_service.analyze_cost_of_living(user_id, request.data, tier=tier)
    return {"analysis": analysis}
