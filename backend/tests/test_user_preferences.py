from unittest.mock import patch, MagicMock
from app.schemas.user_preference import UserPreference

def test_get_preferences_default(client, mock_db):
    # Setup mock: Document does not exist
    mock_doc = MagicMock()
    mock_doc.exists = False
    mock_db.collection().document().get.return_value = mock_doc
    
    response = client.get("/api/preferences/")
    
    assert response.status_code == 200
    data = response.json()
    assert data["language"] == "pt-BR"
    assert data["theme"] == "light"
    assert data["version"] == 1

def test_get_preferences_existing(client, mock_db):
    # Setup mock: Document exists
    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {
        "user_id": "test_user_id",
        "language": "en-US",
        "theme": "dark",
        "notifications_enabled": False,
        "version": 5,
        "updated_at": "2023-01-01T00:00:00"
    }
    mock_db.collection().document().get.return_value = mock_doc
    
    response = client.get("/api/preferences/")
    
    assert response.status_code == 200
    data = response.json()
    assert data["language"] == "en-US"
    assert data["theme"] == "dark"

def test_update_preferences(client, mock_db):
    # Setup mock: Existing doc to get version
    mock_doc_get = MagicMock()
    mock_doc_get.exists = True
    mock_doc_get.to_dict.return_value = {"version": 1}
    
    # Setup mock: Return value after set (for the second get call in update_preferences)
    mock_doc_after = MagicMock()
    mock_doc_after.to_dict.return_value = {
        "user_id": "test_user_id",
        "language": "en-US",
        "theme": "dark",
        "version": 2,
        "updated_at": "2023-01-01T00:00:00"
    }
    
    # Configure side_effect for get() to return different values
    mock_db.collection().document().get.side_effect = [mock_doc_get, mock_doc_after]
    
    payload = {"theme": "dark", "language": "en-US"}
    response = client.put("/api/preferences/", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    assert data["theme"] == "dark"
    assert data["version"] == 2
    
    # Verify DB set was called
    mock_db.collection().document().set.assert_called()

@patch("app.services.user_preference.shutil.copyfileobj")
@patch("app.services.user_preference.os.makedirs")
@patch("builtins.open")
def test_upload_avatar(mock_open, mock_makedirs, mock_copy, client, mock_db):
    # Mock file upload
    file_content = b"fake image content"
    files = {"file": ("avatar.jpg", file_content, "image/jpeg")}
    
    # Mock DB update
    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {"version": 1}
    mock_db.collection().document().get.return_value = mock_doc
    
    response = client.post("/api/preferences/avatar", files=files)
    
    assert response.status_code == 200
    data = response.json()
    assert "/static/profile_images/test_user_id.jpg" in data["url"]
    
    # Verify file operations
    mock_makedirs.assert_called()
    mock_open.assert_called()
