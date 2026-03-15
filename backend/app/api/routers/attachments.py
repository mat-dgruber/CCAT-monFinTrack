import io
import uuid

from app.core.logger import get_logger
from app.core.security import get_current_user
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

logger = get_logger(__name__)

router = APIRouter()


@router.post("/upload")
async def upload_attachment(
    file: UploadFile = File(...), current_user: dict = Depends(get_current_user)
):
    try:
        user_id = current_user["uid"]
        file_ext = file.filename.split(".")[-1] if "." in file.filename else "bin"
        filename = f"{uuid.uuid4()}.{file_ext}"

        # Read file content
        content = await file.read()

        from app.services.storage_service import storage_service

        internal_path = storage_service.upload_file(
            file_content=content,
            filename=filename,
            folder="attachments",
            content_type=file.content_type,
            user_id=user_id,
        )

        # Return a relative API URL that points to our secure endpoint
        return {"url": f"/api/attachments/{internal_path}"}

    except Exception as e:
        logger.error("Upload Error: %s", e)
        raise HTTPException(status_code=500, detail="Failed to upload file") from e


@router.get("/users/{uid}/{folder}/{filename}")
async def serve_attachment(
    uid: str, folder: str, filename: str, current_user: dict = Depends(get_current_user)
):
    """
    Securely serves an attachment after verifying user ownership.
    """
    # Authorization: Only allow user to access their own files
    if current_user["uid"] != uid:
        raise HTTPException(status_code=403, detail="Access denied to this file.")

    from app.services.storage_service import storage_service

    # Internal path follows the storage structure: users/uid/folder/filename
    internal_path = f"users/{uid}/{folder}/{filename}"

    try:
        content = storage_service.get_file_content(internal_path)

        # Determine media type based on extension
        media_type = "application/octet-stream"
        if filename.lower().endswith(".pdf"):
            media_type = "application/pdf"
        elif filename.lower().endswith((".jpg", ".jpeg")):
            media_type = "image/jpeg"
        elif filename.lower().endswith(".png"):
            media_type = "image/png"

        return StreamingResponse(io.BytesIO(content), media_type=media_type)

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail="File not found.") from e
    except Exception as e:
        logger.error("Error serving file: %s", e)
        raise HTTPException(status_code=500, detail="Error retrieving file.") from e
