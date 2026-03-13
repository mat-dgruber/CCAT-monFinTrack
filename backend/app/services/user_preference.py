import os
from datetime import datetime, timezone

from app.core.database import get_db
from app.schemas.user_preference import UserPreference, UserPreferenceCreate
from fastapi import UploadFile

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

    from app.services.storage_service import storage_service

    return storage_service.upload_file(
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
    from app.services import account as account_service
    from app.services import budget as budget_service
    from app.services import category as category_service
    from app.services import recurrence as recurrence_service
    from app.services import transaction as transaction_service

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

    # 6. Reset Preferences (Optional - keeping it simple for now, maybe just update timestamp)
    update_preferences(
        user_id, UserPreferenceCreate(updated_at=datetime.now(timezone.utc))
    )

    return {"status": "success", "message": "Account reset successfully"}
