import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime
from app.services import transaction as transaction_service
from app.schemas.transaction import TransactionCreate, TransactionType, TransactionStatus, PaymentMethod
from app.schemas.category import Category, CategoryType
from app.schemas.account import Account, AccountType
from app.schemas.recurrence import RecurrencePeriodicity

@pytest.fixture
def mock_db():
    with patch("app.services.transaction.get_db") as mock:
        mock_firestore_client = MagicMock()
        mock.return_value = mock_firestore_client
        yield mock_firestore_client

@pytest.fixture
def mock_external_services():
    with patch("app.services.transaction.category_service") as cat_mock, \
         patch("app.services.transaction.account_service") as acc_mock, \
         patch("app.services.transaction.recurrence_service") as rec_mock, \
         patch("app.services.transaction._update_account_balance") as balance_mock:
        yield cat_mock, acc_mock, rec_mock, balance_mock

def test_create_transaction_simple(mock_db, mock_external_services):
    cat_mock, acc_mock, _, balance_mock = mock_external_services
    user_id = "user123"
    
    # Input
    t_in = TransactionCreate(
        title="Lunch",
        description="Lunch",
        amount=50.0,
        type=TransactionType.EXPENSE,
        category_id="cat1",
        account_id="acc1",
        date=datetime.now(),
        status=TransactionStatus.PAID,
        payment_method=PaymentMethod.DEBIT_CARD
    )
    
    # Mocks
    cat_mock.get_category.return_value = Category(id="cat1", name="Food", type="expense", icon="", color="", is_custom=False)
    acc_mock.get_account.return_value = Account(id="acc1", name="Bank", type="checking", balance=100)
    
    mock_doc_ref = MagicMock()
    mock_doc_ref.id = "trans1"
    mock_db.collection.return_value.add.return_value = (None, mock_doc_ref)
    
    # Execute
    result = transaction_service.create_transaction(t_in, user_id)
    
    # Verify
    assert result.id == "trans1"
    assert result.amount == 50.0
    # Create should trigger balance update if PAID
    balance_mock.assert_called_once()
    mock_db.collection.return_value.add.assert_called_once()

def test_create_unified_transaction_installments(mock_db, mock_external_services):
    cat_mock, acc_mock, _, balance_mock = mock_external_services
    user_id = "user123"
    
    # Input: 3 Installments
    t_in = TransactionCreate(
        title="Laptop",
        description="Laptop",
        amount=100.0, # 100 per installment
        type=TransactionType.EXPENSE,
        category_id="cat1",
        account_id="acc1",
        date=datetime(2023, 1, 1),
        status=TransactionStatus.PAID, # First one paid
        total_installments=3,
        payment_method=PaymentMethod.CREDIT_CARD
    )
    
    # Mocks
    cat_mock.get_category.return_value = Category(id="cat1", name="Tech", type="expense", icon="", color="", is_custom=False)
    acc_mock.get_account.return_value = Account(id="acc1", name="Bank", type="checking", balance=1000)
    
    # Mock db add - returns distinct IDs
    def add_side_effect(data):
        m = MagicMock()
        m.id = f"trans_{data['installment_number']}"
        return (None, m)
    mock_db.collection.return_value.add.side_effect = add_side_effect
    
    # Execute
    results = transaction_service.create_unified_transaction(t_in, user_id)
    
    # Verify
    assert len(results) == 3
    
    # Check 1st Installment
    assert results[0].description == "Laptop (1/3)"
    # Status should be respected (PAID)
    # The code passes the input status to the first one?
    # Logic: if i==0: pass (keeps input status).
    # Since t_in.status is PAID, first should be PAID.
    # Check if balance updated for first
    # Implementation calls create_transaction for each. create_transaction calls balance update if PAID.
    # So balance update should be called for the first one.
    
    # Check 2nd Installment
    assert results[1].description == "Laptop (2/3)"
    assert results[1].status == TransactionStatus.PENDING # Others are PENDING
    
    # Verify balance calls: Should be 1 (only first is paid)
    assert balance_mock.call_count == 1

def test_create_unified_transaction_recurrence(mock_db, mock_external_services):
    cat_mock, acc_mock, rec_mock, balance_mock = mock_external_services
    user_id = "user123"
    
    t_in = TransactionCreate(
        title="Netflix",
        description="Netflix",
        amount=15.0,
        type=TransactionType.EXPENSE,
        category_id="cat1",
        account_id="acc1",
        date=datetime(2023, 1, 1),
        recurrence_periodicity=RecurrencePeriodicity.MONTHLY,
        recurrence_create_first=True,
        recurrence_auto_pay=True,
        payment_method=PaymentMethod.CREDIT_CARD
    )
    
    rec_mock.create_recurrence.return_value = MagicMock(id="rec1")
    cat_mock.get_category.return_value = Category(id="cat1", name="Sub", type="expense", icon="", color="", is_custom=False)
    acc_mock.get_account.return_value = Account(id="acc1", name="Bank", type="checking", balance=1000)
    
    mock_db.collection.return_value.add.return_value = (None, MagicMock(id="trans1"))

    # Execute
    results = transaction_service.create_unified_transaction(t_in, user_id)
    
    # Verify
    assert len(results) == 1
    rec_mock.create_recurrence.assert_called_once()
    assert results[0].recurrence_id == "rec1"

def test_delete_transaction_simple(mock_db, mock_external_services):
    _, _, _, balance_mock = mock_external_services
    user_id = "user123"
    
    # Mock retrieval
    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {
        "user_id": user_id, 
        "amount": 50.0, 
        "type": "expense", 
        "account_id": "acc1",
        "status": TransactionStatus.PAID
    }
    mock_db.collection.return_value.document.return_value.get.return_value = mock_doc
    
    # Execute
    transaction_service.delete_transaction("trans1", user_id)
    
    # Verify
    mock_db.collection.return_value.document.return_value.delete.assert_called_once()
    # Should revert balance because it was PAID expense
    balance_mock.assert_called_once_with(mock_db, "acc1", 50.0, "expense", user_id, revert=True)

