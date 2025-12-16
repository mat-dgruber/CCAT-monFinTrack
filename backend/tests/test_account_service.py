import pytest
from unittest.mock import MagicMock, patch
from app.services import account as account_service
from app.schemas.account import AccountCreate, AccountType

@pytest.fixture
def mock_db():
    with patch("app.services.account.get_db") as mock:
        mock_firestore_client = MagicMock()
        mock.return_value = mock_firestore_client
        yield mock_firestore_client

def test_create_account(mock_db):
    # Setup
    user_id = "test_user_id"
    account_in = AccountCreate(
        name="Test Account",
        type=AccountType.CHECKING,
        balance=100.0,
        icon="pi pi-wallet",
        color="#000000"
    )
    
    # Mock Document Reference from .add()
    mock_doc_ref = MagicMock()
    mock_doc_ref.id = "new_account_id"
    mock_db.collection.return_value.add.return_value = (None, mock_doc_ref)
    
    # Execute
    result = account_service.create_account(account_in, user_id)
    
    # Verify
    assert result.id == "new_account_id"
    assert result.name == "Test Account"
    assert result.balance == 100.0
    # Verify that user_id was added to the document
    mock_db.collection.return_value.add.assert_called_once()
    call_args = mock_db.collection.return_value.add.call_args[0][0]
    assert call_args["user_id"] == user_id

def test_list_accounts(mock_db):
    # Setup
    user_id = "test_user_id"
    
    # Mock stream results
    mock_doc1 = MagicMock()
    mock_doc1.id = "acc1"
    mock_doc1.to_dict.return_value = {
        "name": "Account 1", "type": "checking", "balance": 50.0, "user_id": user_id, "icon": "", "color": ""
    }
    
    mock_doc2 = MagicMock()
    mock_doc2.id = "acc2"
    mock_doc2.to_dict.return_value = {
        "name": "Account 2", "type": "savings", "balance": 1000.0, "user_id": user_id, "icon": "", "color": ""
    }
    
    mock_db.collection.return_value.where.return_value.stream.return_value = [mock_doc1, mock_doc2]
    
    # Execute
    accounts = account_service.list_accounts(user_id)
    
    # Verify
    assert len(accounts) == 2
    assert accounts[0].id == "acc1"
    assert accounts[1].name == "Account 2"
    # Verify filter
    mock_db.collection.return_value.where.assert_called_with("user_id", "==", user_id)

def test_update_account_success(mock_db):
    # Setup
    user_id = "test_user_id"
    account_id = "acc1"
    account_in = AccountCreate(
        name="Updated Name",
        type=AccountType.CHECKING,
        balance=200.0,
        icon="pi", 
        color="#fff"
    )
    
    # Mock retrieval for permission check
    mock_doc_snap = MagicMock()
    mock_doc_snap.exists = True
    mock_doc_snap.to_dict.return_value = {"user_id": user_id, "name": "Old Name"}
    
    mock_db.collection.return_value.document.return_value.get.return_value = mock_doc_snap
    
    # Execute
    result = account_service.update_account(account_id, account_in, user_id)
    
    # Verify
    assert result.name == "Updated Name"
    mock_db.collection.return_value.document.return_value.update.assert_called_once()
    
def test_delete_account_success(mock_db):
     # Setup
    user_id = "test_user_id"
    account_id = "acc1"
    
    # Mock retrieval
    mock_doc_snap = MagicMock()
    mock_doc_snap.exists = True
    mock_doc_snap.to_dict.return_value = {"user_id": user_id}
    
    mock_db.collection.return_value.document.return_value.get.return_value = mock_doc_snap
    
    # Execute
    account_service.delete_account(account_id, user_id)
    
    # Verify
    mock_db.collection.return_value.document.return_value.delete.assert_called_once()

def test_delete_account_access_denied(mock_db):
     # Setup
    user_id = "test_user_id"
    account_id = "acc1"
    
    # Mock retrieval: User ID mismatch
    mock_doc_snap = MagicMock()
    mock_doc_snap.exists = True
    mock_doc_snap.to_dict.return_value = {"user_id": "other_user"}
    
    mock_db.collection.return_value.document.return_value.get.return_value = mock_doc_snap
    
    # Execute & Verify
    with pytest.raises(Exception) as excinfo: # It raises HTTPException actually
        account_service.delete_account(account_id, user_id)
    
    assert "404" in str(excinfo.value)
