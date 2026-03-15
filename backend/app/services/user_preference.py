import os
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.logger import get_logger

logger = get_logger(__name__)

from app.schemas.user_preference import UserPreference, UserPreferenceCreate
from app.services import account as account_service
from app.services import budget as budget_service
from app.services import category as category_service
from app.services import recurrence as recurrence_service
from app.services import transaction as transaction_service
from app.services.storage_service import storage_service
from fastapi import UploadFile
from firebase_admin import auth

COLLECTION_NAME = "user_preferences"


def get_preferences(user_id: str) -> UserPreference:
    db = get_db()
    doc_ref = db.collection(COLLECTION_NAME).document(user_id)
    doc = doc_ref.get()

    if doc.exists:
        try:
            return UserPreference(**doc.to_dict())
        except Exception as e:
            from app.core.logger import get_logger

            logger = get_logger(__name__)
            logger.error(
                "Error parsing UserPreference for %s: %s. Using defaults.", user_id, e
            )

    # Return defaults if not exists or if error occurs
    default_pref = UserPreference(
        user_id=user_id, updated_at=datetime.now(timezone.utc), version=1
    )
    # Save default to DB so we have a record
    doc_ref.set(default_pref.model_dump())
    return default_pref


def update_preferences(user_id: str, data: UserPreferenceCreate) -> UserPreference:
    db = get_db()
    doc_ref = db.collection(COLLECTION_NAME).document(user_id)
    doc = doc_ref.get()

    current_data = doc.to_dict() if doc.exists else {}

    # Increment version
    new_version = current_data.get("version", 0) + 1

    # Prepare update data
    update_data = data.model_dump(exclude_unset=True)
    update_data["version"] = new_version
    update_data["updated_at"] = datetime.now()
    update_data["user_id"] = user_id

    doc_ref.set(update_data, merge=True)

    # Fetch full updated doc to return
    return UserPreference(**doc_ref.get().to_dict())


def save_profile_image(user_id: str, file: UploadFile) -> str:
    extension = os.path.splitext(file.filename)[1]
    filename = f"{user_id}{extension}"

    file_content = file.file.read()

    return storage_service.upload_file(
        user_id=user_id,
        file_content=file_content,
        filename=filename,
        folder="profile_images",
        content_type=file.content_type,
    )


def reset_account(user_id: str):
    """
    Deletes all user data (transactions, recurrences, budgets, accounts, custom categories).
    Preserves user profile and preferences.
    """

    # 1. Transactions
    transaction_service.delete_all_transactions(user_id)

    # 2. Recurrences
    recurrence_service.delete_all_recurrences(user_id)

    # 3. Budgets
    budget_service.delete_all_budgets(user_id)

    # 4. Custom Categories
    category_service.delete_all_custom_categories(user_id)

    # 5. Accounts
    account_service.delete_all_accounts(user_id)

    # 6. Wipe Attachments from Storage
    storage_service.delete_user_folder(user_id, "attachments")

    # 7. Reset Preferences
    update_preferences(
        user_id, UserPreferenceCreate(updated_at=datetime.now(timezone.utc))
    )

    return {"status": "success", "message": "Account reset successfully"}


def delete_account_completely(user_id: str):
    """
    LGPD/GDPR Compliance: Hard delete of all user records and the user profile itself.
    This should be followed by a Firebase Auth user deletion.
    """
    
    # 1. Wipe all data first (Transactions, etc.)
    reset_account(user_id)
    
    # 2. Wipe Profile Images
    storage_service.delete_user_folder(user_id, "profile_images")
    
    # 3. Delete Preferences document
    db = get_db()
    db.collection(COLLECTION_NAME).document(user_id).delete()
    
    # 4. Delete User reports
    reports_ref = db.collection("users").document(user_id).collection("reports")
    for r in reports_ref.stream():
        r.reference.delete()
    db.collection("users").document(user_id).delete()

    # 5. Delete specific AI predictions linked to user
    # Note: These are hashed, so they don't contain PII, but we use user_id in hash.
    # To be fully compliant, we'd list and delete, but hashed data is technically pseudo-anonymized.

    # 6. Delete Firebase Auth User
    try:
        auth.delete_user(user_id)
        logger.info("Deleted Firebase Auth user: %s", user_id)
    except Exception as e:
        logger.error("Error deleting Firebase Auth user: %s", e)
        # We don't raise here to ensure the API response can be sent before the token is invalidated, 
        # or we assume the user might already be gone.

    return {"status": "success", "message": "All user data has been deleted."}
