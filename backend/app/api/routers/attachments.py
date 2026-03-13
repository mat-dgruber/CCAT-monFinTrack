import uuid

from app.core.logger import get_logger
from app.core.security import get_current_user
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

logger = get_logger(__name__)

router = APIRouter()


@router.post("/upload")
async def upload_attachment(
    file: UploadFile = File(...), current_user: dict = Depends(get_current_user)
):
    try:
        file_ext = file.filename.split(".")[-1] if "." in file.filename else "bin"
        filename = f"{uuid.uuid4()}.{file_ext}"

        # Read file content
        content = await file.read()

        from app.services.storage_service import storage_service

        url = storage_service.upload_file(
            file_content=content,
            filename=filename,
            folder="attachments",
            content_type=file.content_type,
        )

        return {"url": url}

    except Exception as e:
        logger.error("Upload Error: %s", e)
        raise HTTPException(status_code=500, detail="Failed to upload file")
