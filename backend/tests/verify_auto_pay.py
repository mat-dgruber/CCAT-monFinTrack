import sys
import os
from datetime import datetime, timedelta
from unittest.mock import MagicMock

# Add backend to path
sys.path.append("c:/Users/matheus.diniz/Documents/GitHub/CCAT/monFinTrack/backend")

# Mock services BEFORE importing transaction service
sys.modules["app.services.recurrence"] = MagicMock()
sys.modules["app.services.category"] = MagicMock()
sys.modules["app.services.account"] = MagicMock()
sys.modules["app.core.database"] = MagicMock()

# Mock RecurrenceCreate and RecurrencePeriodicity which are imported in transaction.py
# We need to make sure they are available. They are in schemas.
# Since we import create_unified_transaction, it imports schemas.
# We don't need to mock schemas, just services.

# Now import
try:
    from app.services.transaction import create_unified_transaction
    from app.schemas.transaction import TransactionCreate, TransactionType, PaymentMethod, TransactionStatus
    import app.services.transaction as t_service
except ImportError as e:
    print(f"Import Error: {e}")
    sys.exit(1)

# Mock create_transaction to just return the input data so we can inspect it
def mock_create_transaction(t_in, uid):
    return t_in

t_service.create_transaction = mock_create_transaction

# Mock recurrence creation to return a dummy object with an id
mock_rec = MagicMock()
mock_rec.id = "rec_123"
t_service.recurrence_service.create_recurrence.return_value = mock_rec

def test():
    user_id = "test_user"
    
    print("--- Testing Auto-Pay Logic ---")

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
        status=TransactionStatus.PAID, # User tries to create as PAID
        recurrence_periodicity="monthly", 
        recurrence_auto_pay=True, 
        recurrence_create_first=True
    )
    
    try:
        res = create_unified_transaction(t_in, user_id)
        # res[0] is the object returned by mock_create_transaction, which is t_in (TransactionCreate)
        # But wait, create_unified_transaction creates a NEW TransactionCreate inside.
        # So res[0] is the NEW object.
        
        status = res[0].status
        print(f"Future Date ({future_date.strftime('%Y-%m-%d')}): Expected PENDING, Got {status}")
        if status == TransactionStatus.PENDING:
            print("✅ PASS")
        else:
            print("❌ FAIL")
            
    except Exception as e:
        print(f"Error in Case 1: {e}")

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
        status=TransactionStatus.PAID, # User wants PAID
        recurrence_periodicity="monthly", 
        recurrence_auto_pay=True, 
        recurrence_create_first=True
    )
    
    try:
        res2 = create_unified_transaction(t_in2, user_id)
        status2 = res2[0].status
        print(f"Today ({today.strftime('%Y-%m-%d')}): Expected PAID, Got {status2}")
        if status2 == TransactionStatus.PAID:
            print("✅ PASS")
        else:
            print("❌ FAIL")
            
    except Exception as e:
        print(f"Error in Case 2: {e}")

if __name__ == "__main__":
    test()
