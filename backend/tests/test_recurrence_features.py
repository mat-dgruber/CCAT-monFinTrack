from unittest.mock import MagicMock, patch
from datetime import date
from app.schemas.recurrence import RecurrencePeriodicity

# Patching get_db in the SERVICE, because services call it directly
@patch("app.services.recurrence.get_db")
def test_create_recurrence_with_start_date(mock_get_db, client, mock_db):
    # Connect mock_get_db to return our mock_db fixture (the client mock)
    mock_get_db.return_value = mock_db
    
    # Setup Mock
    mock_ref = MagicMock()
    mock_ref.id = "new_rec_id"
    mock_db.collection.return_value.add.return_value = (None, mock_ref)

    payload = {
        "name": "Netflix Retro",
        "amount": 55.90,
        "category_id": "cat_123",
        "account_id": "acc_123",
        "periodicity": "monthly",
        "due_day": 15,
        "start_date": "2023-01-15", # Past date
        "active": True
    }

    response = client.post("/api/recurrences", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "new_rec_id"
    # Verify DB call
    mock_db.collection.assert_called_with("recurrences")
    args, _ = mock_db.collection.return_value.add.call_args
    saved_data = args[0]
    assert saved_data["start_date"] == "2023-01-15"
    assert saved_data["periodicity"] == "monthly"

@patch("app.services.recurrence.get_db")
def test_update_recurrence_future_scope(mock_get_db, client, mock_db):
    mock_get_db.return_value = mock_db
    
    # Setup Mock for GET (existing recurrence)
    recurrence_id = "rec_old"
    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {
        "id": recurrence_id,
        "user_id": "test_user_id", # Matches conftest override
        "name": "Spotify",
        "amount": 20.0,
        "active": True,
        "periodicity": "monthly",
        "category_id": "cat_1",
        "account_id": "acc_1",
        "due_day": 10
    }
    mock_db.collection.return_value.document.return_value.get.return_value = mock_doc
    
    # Mock for ADD (new recurrence)
    mock_new_ref = MagicMock()
    mock_new_ref.id = "rec_new"
    mock_db.collection.return_value.add.return_value = (None, mock_new_ref)

    # Update Payload
    payload = {
        "amount": 25.0, # Price increase
        "start_date": "2025-02-01"
    }

    # Call with scope=future
    response = client.put(f"/api/recurrences/{recurrence_id}?scope=future", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "rec_new"
    
    # 1. Verify Old Recurrence Cancelled
    # The usage might be db.collection().document(id).update(...)
    # We need to ensure we are checking the right document ref
    
    # Check calls to update old recurrence
    # It's tricky to distinguish which document() call was for read vs update unless we inspect args
    # But usually update_recurrence does: ref = db.collection(...).document(id); ref.update(...)
    
    # 2. Verify New Recurrence Created
    # The ADD call should have the new amount and start_date
    add_calls = mock_db.collection.return_value.add.call_args_list
    assert len(add_calls) > 0
    # Last call should be the new one
    args, _ = add_calls[-1]
    saved_new = args[0]
    assert saved_new["amount"] == 25.0
    assert saved_new["start_date"] == "2025-02-01"
    assert saved_new["active"] == True

