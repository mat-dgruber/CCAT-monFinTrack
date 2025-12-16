import sys
from datetime import datetime, timedelta
from unittest.mock import MagicMock

# Add backend to path
sys.path.append("c:/Users/matheus.diniz/Documents/GitHub/CCAT/monFinTrack/backend")

# Mock ALL dependencies before importing transaction service
sys.modules["app.services.recurrence"] = MagicMock()
sys.modules["app.services.category"] = MagicMock()
sys.modules["app.services.account"] = MagicMock()
sys.modules["app.core.database"] = MagicMock()
sys.modules["google.cloud"] = MagicMock()
sys.modules["google.cloud.firestore"] = MagicMock()

# Import transaction service
# We need to handle the imports inside transaction.py
# It imports TransactionCreate from app.schemas.transaction
# We need to make sure schemas are importable or mocked.
# They are Pydantic models, so better to let them import if possible.

try:
    from app.schemas.transaction import TransactionCreate, TransactionType, PaymentMethod, TransactionStatus
    # Now import the function to test
    # We will import the module so we can patch create_transaction inside it
    import app.services.transaction as t_service
except ImportError as e:
    print(f"Import Error: {e}")
    sys.exit(1)

# Mock create_transaction to just return the input data
def mock_create_transaction(t_in, uid):
    return t_in

t_service.create_transaction = mock_create_transaction

# Mock recurrence creation
mock_rec = MagicMock()
mock_rec.id = "rec_123"
t_service.recurrence_service.create_recurrence.return_value = mock_rec

def test():
    print("--- Testing Auto-Pay Logic (Simple) ---")
    user_id = "test_user"

    # Case 1: Future Date
    future_date = datetime.now() + timedelta(days=5)
    t_in = TransactionCreate(
        description="Future Transaction", 
        amount=100.0, 
        date=future_date, 
        category_id="cat_1", 
        account_id="acc_1", 
        type=TransactionType.EXPENSE, 
        payment_method=PaymentMethod.OTHER, 
        status=TransactionStatus.PAID, 
        recurrence_periodicity="monthly", 
        recurrence_auto_pay=True, 
        recurrence_create_first=True
    )
    
    res = t_service.create_unified_transaction(t_in, user_id)
    status = res[0].status
    print(f"Future Date: Expected PENDING, Got {status}")
    
    # Case 2: Today
    today = datetime.now()
    t_in2 = TransactionCreate(
        description="Today Transaction", 
        amount=100.0, 
        date=today, 
        category_id="cat_1", 
        account_id="acc_1", 
        type=TransactionType.EXPENSE, 
        payment_method=PaymentMethod.OTHER, 
        status=TransactionStatus.PAID, 
        recurrence_periodicity="monthly", 
        recurrence_auto_pay=True, 
        recurrence_create_first=True
    )
    
    res2 = t_service.create_unified_transaction(t_in2, user_id)
    status2 = res2[0].status
    print(f"Today: Expected PAID, Got {status2}")

if __name__ == "__main__":
    test()
