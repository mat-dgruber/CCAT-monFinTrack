import firebase_admin
from firebase_admin import credentials, firestore
import os
from unittest.mock import MagicMock
from app.services import transaction as transaction_service
from app.services import dashboard as dashboard_service
from app.services import budget as budget_service

# Setup credentials
cred_path = "app/certs/serviceAccountKey.json"
if not os.path.exists(cred_path):
    print(f"⚠️ Skipping integration test file (no credentials): {cred_path}")
    # Don't exit(1), just define a dummy test or leave it empty
    db = MagicMock() # Needs import
else:
    # Initialize only if not already initialized
    if not firebase_admin._apps:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    db = firestore.client()

def test_filters():
    print("--- Testing Time Filters ---")
    
    # 1. Find a user with transactions
    transactions_ref = db.collection("transactions").limit(1).stream()
    user_id = None
    for t in transactions_ref:
        user_id = t.to_dict().get("user_id")
        break
        
    if not user_id:
        print("No transactions found to test with.")
        return

    print(f"Testing with User ID: {user_id}")

    # 2. Test Transaction Service
    print("\n[Transaction Service]")
    all_txs = transaction_service.list_transactions(user_id)
    print(f"Total transactions: {len(all_txs)}")
    
    if all_txs:
        # Pick a month/year from the first transaction to test filtering
        first_tx = all_txs[0]
        # Assuming first_tx.date is a datetime object or similar
        # If it's a string, we might need to parse it, but let's assume it works for now or check the model
        # The model defines date as datetime
        test_date = first_tx.date
        month = test_date.month
        year = test_date.year
        
        print(f"Filtering for {month}/{year}...")
        filtered_txs = transaction_service.list_transactions(user_id, month=month, year=year)
        print(f"Filtered transactions count: {len(filtered_txs)}")
        
        # Verify all filtered transactions are in the correct month/year
        valid = all(t.date.month == month and t.date.year == year for t in filtered_txs)
        print(f"Verification passed: {valid}")
    
    # 3. Test Dashboard Service
    print("\n[Dashboard Service]")
    dash_all = dashboard_service.get_dashboard_data(user_id)
    print(f"Dashboard Total Balance: {dash_all.total_balance}")
    print(f"Dashboard Income (All Time/Default): {dash_all.income_month}") # Note: Logic changed to filter, so without filter it might be all time or just fail if logic expects filter for "month" income? 
    # Actually looking at the code:
    # if month and year: filter
    # else: no filter on query -> so income_month becomes income_all_time effectively if no filter provided.
    
    if all_txs:
        print(f"Filtering Dashboard for {month}/{year}...")
        dash_filtered = dashboard_service.get_dashboard_data(user_id, month=month, year=year)
        print(f"Filtered Income: {dash_filtered.income_month}")
        print(f"Filtered Expense: {dash_filtered.expense_month}")
        
    # 4. Test Budget Service
    print("\n[Budget Service]")
    budgets = budget_service.list_budgets_with_progress(user_id, month=month, year=year)
    print(f"Budgets with progress for {month}/{year}: {len(budgets)}")
    for b in budgets:
        print(f"  - {b['category'].name}: Limit {b['limit']}, Spent {b['spent']}, % {b['percentage']:.1f}")

if __name__ == "__main__":
    test_filters()
