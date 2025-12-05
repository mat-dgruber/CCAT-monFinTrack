import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock
from app.main import app
from app.core.database import get_db
from app.core.security import get_current_user

# Mock Firestore Client
mock_firestore_client = MagicMock()
mock_collection = MagicMock()
mock_document = MagicMock()

# Setup chain: db.collection().document()
mock_firestore_client.collection.return_value = mock_collection
mock_collection.document.return_value = mock_document

def override_get_db():
    return mock_firestore_client

def override_get_current_user():
    return {"uid": "test_user_id", "email": "test@example.com"}

app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[get_current_user] = override_get_current_user

@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c

@pytest.fixture
def mock_db():
    return mock_firestore_client
