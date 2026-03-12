"""
Tests for user preferences service.
Uses isolated mocks to avoid conftest chain pollution.
"""

from unittest.mock import MagicMock, patch


def test_get_preferences_default():
    """When no preference doc exists, defaults are returned."""
    with patch("app.services.user_preference.get_db") as mock_get_db:
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db

        # Document does not exist
        mock_doc = MagicMock()
        mock_doc.exists = False
        mock_db.collection.return_value.document.return_value.get.return_value = (
            mock_doc
        )

        from app.services.user_preference import get_preferences

        result = get_preferences("test_user_id")

        assert result.language == "pt-BR"
        assert result.theme == "light"
        assert result.version == 1
        # Should save defaults to DB
        mock_db.collection.return_value.document.return_value.set.assert_called_once()


def test_get_preferences_existing():
    """When preference doc exists, stored values are returned."""
    with patch("app.services.user_preference.get_db") as mock_get_db:
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db

        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {
            "user_id": "test_user_id",
            "language": "en-US",
            "theme": "dark",
            "notifications_enabled": False,
            "version": 5,
            "updated_at": "2023-01-01T00:00:00",
        }
        mock_db.collection.return_value.document.return_value.get.return_value = (
            mock_doc
        )

        from app.services.user_preference import get_preferences

        result = get_preferences("test_user_id")

        assert result.language == "en-US"
        assert result.theme == "dark"
        assert result.version == 5


def test_update_preferences():
    """Updating preferences increments version and merges data."""
    with patch("app.services.user_preference.get_db") as mock_get_db:
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db

        # First get() call returns existing doc with version 1
        mock_doc_get = MagicMock()
        mock_doc_get.exists = True
        mock_doc_get.to_dict.return_value = {"version": 1}

        # Second get() call (after set) returns updated doc
        mock_doc_after = MagicMock()
        mock_doc_after.to_dict.return_value = {
            "user_id": "test_user_id",
            "language": "en-US",
            "theme": "dark",
            "version": 2,
            "updated_at": "2023-01-01T00:00:00",
        }

        mock_db.collection.return_value.document.return_value.get.side_effect = [
            mock_doc_get,
            mock_doc_after,
        ]

        from app.schemas.user_preference import UserPreferenceCreate
        from app.services.user_preference import update_preferences

        result = update_preferences(
            "test_user_id", UserPreferenceCreate(theme="dark", language="en-US")
        )

        assert result.theme == "dark"
        assert result.version == 2
        mock_db.collection.return_value.document.return_value.set.assert_called_once()


def test_upload_avatar():
    """Avatar upload calls Firebase Storage and returns signed URL."""
    with patch("app.services.user_preference.storage") as mock_storage:
        mock_bucket = MagicMock()
        mock_storage.bucket.return_value = mock_bucket

        mock_blob = MagicMock()
        mock_blob.generate_signed_url.return_value = (
            "https://storage.googleapis.com/profile_images/test_user.jpg?signed=true"
        )
        mock_bucket.blob.return_value = mock_blob

        from app.services.user_preference import save_profile_image

        mock_file = MagicMock()
        mock_file.filename = "avatar.jpg"
        mock_file.content_type = "image/jpeg"
        mock_file.file = MagicMock()

        result = save_profile_image("test_user", mock_file)

        assert "signed=true" in result
        mock_blob.upload_from_file.assert_called_once()
        mock_blob.generate_signed_url.assert_called_once()
