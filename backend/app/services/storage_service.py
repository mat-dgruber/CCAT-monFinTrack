import os

from app.core.logger import get_logger
from firebase_admin import storage

logger = get_logger(__name__)


class StorageService:
    def __init__(self):
        self.use_local = (
            os.getenv("USE_LOCAL_STORAGE", "false").lower() == "true"
            or os.getenv("ENV", "development") == "development"
        )
        # Move local storage outside of /static to prevent public access
        self.local_base_dir = "data/storage"

    def upload_file(
        self,
        file_content: bytes,
        filename: str,
        folder: str,
        content_type: str,
        user_id: str,
    ) -> str:
        """
        Uploads a file to local storage or Firebase Storage.
        Includes user_id in the path for isolation.
        Returns the internal path (relative to base dir).
        """
        # Isolation: users/user_id/folder/filename (Aligned with Firebase Rules)
        relative_path = f"users/{user_id}/{folder}/{filename}"

        if self.use_local:
            save_path = os.path.join(self.local_base_dir, relative_path)
            os.makedirs(os.path.dirname(save_path), exist_ok=True)

            with open(save_path, "wb") as f:
                f.write(file_content)

            return relative_path
        else:
            try:
                bucket = storage.bucket()
                blob = bucket.blob(relative_path)

                # Upload bytes
                blob.upload_from_string(file_content, content_type=content_type)

                return relative_path
            except Exception as e:
                logger.error("Firebase Storage Upload Error: %s", e)
                raise e

    def get_file_content(self, path: str) -> bytes:
        """
        Retrieves file content from internal path or URL.
        Handles both local storage (data/storage) and Firebase Storage.
        """
        if self.use_local:
            # Try internal path first (relative to local_base_dir)
            local_path = os.path.join(self.local_base_dir, path)

            # Fallback for old /static paths if still in use
            if path.startswith("/static/"):
                local_path = f"app{path}"

            if not os.path.exists(local_path):
                logger.error("File not found at path: %s", local_path)
                raise FileNotFoundError(f"Local file not found: {local_path}")

            with open(local_path, "rb") as f:
                return f.read()
        else:
            # Firebase Storage
            try:
                # If it's a full URL, we might need a different approach,
                # but our secure server passes the internal path.
                if path.startswith("http"):
                    import requests

                    response = requests.get(path, timeout=10)
                    response.raise_for_status()
                    return response.content

                bucket = storage.bucket()
                blob = bucket.blob(path)

                if not blob.exists():
                    logger.error("Blob not found in Firebase: %s", path)
                    raise FileNotFoundError(f"Firebase blob not found: {path}")

                return blob.download_as_bytes()
            except Exception as e:
                logger.error("Error retrieving file: %s", e)
                raise e

    def delete_user_folder(self, user_id: str, folder: str):
        """
        Deletes all files for a specific user in a folder.
        """
        prefix = f"users/{user_id}/{folder}/"
        if self.use_local:
            import shutil

            target_dir = os.path.join(self.local_base_dir, folder, user_id)
            if os.path.exists(target_dir):
                shutil.rmtree(target_dir)
                logger.info("Deleted local folder: %s", target_dir)
        else:
            try:
                bucket = storage.bucket()
                blobs = bucket.list_blobs(prefix=prefix)
                for blob in blobs:
                    blob.delete()
                logger.info("Deleted Firebase blobs with prefix: %s", prefix)
            except Exception as e:
                logger.error("Error deleting Firebase blobs: %s", e)
                raise e


# Global instance
storage_service = StorageService()
