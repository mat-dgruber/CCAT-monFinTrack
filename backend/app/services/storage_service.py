import os
from datetime import timedelta
from firebase_admin import storage
from app.core.logger import get_logger

logger = get_logger(__name__)

class StorageService:
    def __init__(self):
        self.use_local = os.getenv("USE_LOCAL_STORAGE", "false").lower() == "true" or os.getenv("ENV", "development") == "development"
        self.local_base_dir = "app/static"

    def upload_file(self, file_content: bytes, filename: str, folder: str, content_type: str) -> str:
        """
        Uploads a file to local storage or Firebase Storage.
        Returns the relative URL (local) or signed URL (Firebase).
        """
        if self.use_local:
            save_dir = os.path.join(self.local_base_dir, folder)
            os.makedirs(save_dir, exist_ok=True)
            file_path = os.path.join(save_dir, filename)
            
            with open(file_path, "wb") as f:
                f.write(file_content)
            
            return f"/static/{folder}/{filename}"
        else:
            try:
                bucket = storage.bucket()
                blob_name = f"{folder}/{filename}"
                blob = bucket.blob(blob_name)
                
                # Upload bytes
                blob.upload_from_string(file_content, content_type=content_type)
                
                # Generate signed URL (v4 is mandatory for modern buckets)
                url = blob.generate_signed_url(
                    version="v4",
                    expiration=timedelta(days=365),
                    method="GET"
                )
                return url
            except Exception as e:
                logger.error("Firebase Storage Upload Error: %s", e)
                raise e

    def get_file_content(self, path_or_url: str) -> bytes:
        """
        Retrieves file content from local path or Firebase Storage.
        """
        if path_or_url.startswith("/static/"):
            # Local file
            local_path = f"app{path_or_url}"
            if not os.path.exists(local_path):
                raise FileNotFoundError(f"Local file not found: {local_path}")
            
            with open(local_path, "rb") as f:
                return f.read()
        elif "storage.googleapis.com" in path_or_url:
            # Firebase Storage URL
            try:
                # Extract blob name from URL if possible, or use storage SDK
                # A safer way is to use the blob name directly if we store it, 
                # but for now let's try to fetch via URL or use the bucket if we can parse it.
                # Actually, signed URLs are tricky to parse back to blob names easily without a helper.
                # However, if it's a signed URL from our own bucket, we can often find the blob name.
                
                # Alternative: if it's a URL, we might need to download it via HTTP if we don't have the blob name.
                # But since we are the backend, we should ideally know the blob name.
                # If we only have the URL, let's use requests or just the SDK if we can map it.
                
                # For CCAT-monFinTrack, we can try to guess the blob name from the path.
                # E.g. https://.../o/attachments%2Fuuid.jpg?... -> attachments/uuid.jpg
                
                # But wait, if it's a signed URL, it might not be easy.
                # Let's use a simpler approach for now: if it's a URL, download it via HTTP.
                import requests
                response = requests.get(path_or_url, timeout=10)
                response.raise_for_status()
                return response.content
            except Exception as e:
                logger.error("Error retrieving file from URL %s: %s", path_or_url, e)
                raise e
        else:
            raise ValueError(f"Unknown file path or URL: {path_or_url}")

# Global instance
storage_service = StorageService()
