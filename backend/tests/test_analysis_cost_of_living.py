
import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, date, timedelta
from app.api import analysis
from app.schemas.transaction import Transaction

# Mock the database
@pytest.fixture
def mock_db():
    with patch("app.api.analysis.get_db") as mock:
        yield mock

# Mock current user
@pytest.fixture
def mock_user():
    return {"uid": "test_user_id"}

# Mock services
@pytest.fixture
def mock_services():
    with patch("app.api.analysis.transaction_service") as tx_mock, \
         patch("app.api.analysis.recurrence_service") as rec_mock:
        yield tx_mock, rec_mock

def test_cost_of_living_new_user(mock_user, mock_services):
    """
    Scenario: New user, first transaction 1 month ago.
    Should use ~1 month divisor instead of 6.
    """
    tx_mock, rec_mock = mock_services
    
    # 1. Setup Data
    # First transaction: 30 days ago
    first_date = datetime.now() - timedelta(days=30)
    tx_mock.get_first_transaction_date.return_value = first_date
    
    # Transactions in range (Cost: 500)
    # Mocking list_transactions to return ONE transaction of 500
    t1 = MagicMock(spec=Transaction)
    t1.amount = 500.0
    t1.type = 'expense' # String or Enum value
    t1.recurrence_id = None
    t1.category_name = "Food"
    
    tx_mock.list_transactions.return_value = [t1]
    
    # No recurrences
    rec_mock.list_recurrences.return_value = []
    
    # 2. Execute
    result = analysis.get_monthly_averages(current_user=mock_user)
    
    # 3. Verify
    # Months count should be approx 1.0 (30 days)
    # Depending on exact date/time, might be slightly more or less than 1.0 depending on days / 30.4375
    # 30 / 30.4375 ~= 0.98. The logic has max(1.0, ...)
    months_count = result["range"]["months_count"]
    assert months_count == 1.0 # Should hit the floor
    
    # Variable Avg: 500 / 1.0 = 500
    assert result["variable_avg"] == 500.0
    assert result["committed"]["total"] == 0
    assert result["total_estimated_monthly"] == 500.0

def test_cost_of_living_recurrence_split(mock_user, mock_services):
    """
    Scenario: User has One Recurrence (1000) and One Variable Expense (200).
    Logic should sum Recurrence (Committed) + Average of Variable.
    """
    tx_mock, rec_mock = mock_services
    
    # 1. Setup Data
    # Old user (First tx long ago)
    tx_mock.get_first_transaction_date.return_value = datetime(2020, 1, 1)
    
    # Transactions in range (last 6 months)
    # - T1: 200 (Variable)
    # - T2: 1000 (Generated from Recurrence - SHOULD BE IGNORED in Variable Avg)
    t1 = MagicMock()
    t1.amount = 200.0
    t1.type = 'expense'
    t1.recurrence_id = None # Variable
    t1.category_name = "Food"

    t2 = MagicMock()
    t2.amount = 1000.0
    t2.type = 'expense'
    t2.recurrence_id = "rec1" # Generated! Should be filtered out
    t2.category_name = "Rent"
    
    tx_mock.list_transactions.return_value = [t1, t2]
    
    # Recurrences (Committed)
    r1 = MagicMock()
    r1.amount = 1000.0
    r1.type = 'expense'
    r1.periodicity = 'monthly'
    rec_mock.list_recurrences.return_value = [r1]
    
    # 2. Execute
    # We expect standard 6 months divisor (approx 6.0)
    result = analysis.get_monthly_averages(current_user=mock_user)
    
    # 3. Verify
    months_count = result["range"]["months_count"]
    # 180 days / 30.4375 ~= 5.91
    assert 5.8 < months_count < 6.1
    
    # Committed: 1000
    assert result["committed"]["total"] == 1000.0
    
    # Variable Avg: 200 / 6 months ~= 33.33
    # Check that T2 was ignored
    variable_avg = result["variable_avg"]
    expected_var = 200.0 / months_count
    assert abs(variable_avg - expected_var) < 0.01
    
    # Total: 1000 + 33.33 = 1033.33
    assert abs(result["total_estimated_monthly"] - (1000 + expected_var)) < 0.01

