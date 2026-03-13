import os
import sys
from unittest.mock import MagicMock, patch

import pytest

# Mock firebase_admin and google auth before any imports
mock_firebase = MagicMock()
sys.modules["firebase_admin"] = mock_firebase
sys.modules["firebase_admin.credentials"] = MagicMock()
sys.modules["firebase_admin.storage"] = MagicMock()
sys.modules["firebase_admin.firestore"] = MagicMock()
sys.modules["google"] = MagicMock()
sys.modules["google.auth"] = MagicMock()
sys.modules["google.cloud"] = MagicMock()
sys.modules["google.oauth2"] = MagicMock()

# Also mock the database to prevent initialize_app in core/database.py
sys.modules["app.core.database"] = MagicMock()

from app.services.storage_service import StorageService


@pytest.fixture
def storage_service_local():
    with patch.dict(os.environ, {"ENV": "development", "USE_LOCAL_STORAGE": "true"}):
        return StorageService()


@pytest.fixture
def storage_service_cloud():
    with patch.dict(os.environ, {"ENV": "production", "USE_LOCAL_STORAGE": "false"}):
        return StorageService()


def test_upload_file_local(storage_service_local, tmp_path):
    # Mock local base dir to use tmp_path
    storage_service_local.local_base_dir = str(tmp_path)

    content = b"hello world"
    filename = "test.txt"
    folder = "test_folder"
    content_type = "text/plain"

    url = storage_service_local.upload_file(content, filename, folder, content_type)

    assert url == f"/static/{folder}/{filename}"

    # Verify file exists
    saved_file = tmp_path / folder / filename
    assert saved_file.exists()
    assert saved_file.read_bytes() == content


@patch("app.services.storage_service.storage.bucket")
def test_upload_file_cloud(mock_bucket_func, storage_service_cloud):
    mock_bucket = MagicMock()
    mock_bucket_func.return_value = mock_bucket

    mock_blob = MagicMock()
    mock_blob.generate_signed_url.return_value = "https://signed-url.com"
    mock_bucket.blob.return_value = mock_blob

    content = b"cloud content"
    filename = "cloud.txt"
    folder = "cloud_folder"
    content_type = "text/plain"

    url = storage_service_cloud.upload_file(content, filename, folder, content_type)

    assert url == "https://signed-url.com"
    mock_blob.upload_from_string.assert_called_once_with(
        content, content_type=content_type
    )


def test_get_file_content_local(storage_service_local, tmp_path):
    storage_service_local.local_base_dir = str(tmp_path)
    # Actually storage_service inside its method hardcodes 'app'.
    # Let's mock open or ensure 'app/static/...' is mapped.

    content = b"local data"
    # We need to mock 'open' because StorageService.get_file_content uses 'app/static/...'
    with patch(
        "builtins.open",
        MagicMock(
            return_value=MagicMock(
                __enter__=MagicMock(
                    return_value=MagicMock(read=MagicMock(return_value=content))
                )
            )
        ),
    ):
        with patch("os.path.exists", return_value=True):
            result = storage_service_local.get_file_content("/static/test/file.txt")
            assert result == content


@patch("requests.get")
def test_get_file_content_url(mock_get, storage_service_cloud):
    mock_response = MagicMock()
    mock_response.content = b"remote data"
    mock_response.status_code = 200
    mock_get.return_value = mock_response

    url = "https://storage.googleapis.com/bucket/file.jpg"
    result = storage_service_cloud.get_file_content(url)

    assert result == b"remote data"
    mock_get.assert_called_once_with(url, timeout=10)
