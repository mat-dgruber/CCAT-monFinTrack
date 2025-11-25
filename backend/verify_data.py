import firebase_admin
from firebase_admin import credentials, firestore
import os
from app.schemas.transaction import Transaction
from app.schemas.category import Category
from app.schemas.account import Account
from app.services import transaction as transaction_service
from app.services import dashboard as dashboard_service

# Setup credentials
cred_path = "app/certs/serviceAccountKey.json"
if not os.path.exists(cred_path):
    print(f"Error: Credential file not found at {cred_path}")
    exit(1)

cred = credentials.Certificate(cred_path)
firebase_admin.initialize_app(cred)
db = firestore.client()

def verify_data():
    print("--- Verifying Data Integrity ---")
    
    # 1. Fetch all transactions
    transactions = db.collection("transactions").stream()
    t_count = 0
    missing_cat_count = 0
    test_user_id = None
    
    for t in transactions:
        t_count += 1
        data = t.to_dict()
        cat_id = data.get("category_id")
        user_id = data.get("user_id")
        
        if user_id and not test_user_id:
            test_user_id = user_id

        if not cat_id:
            print(f"Transaction {t.id} has NO category_id")
            continue
            
        # Check if category exists
        cat_doc = db.collection("categories").document(cat_id).get()
        if not cat_doc.exists:
            print(f"Transaction {t.id} points to MISSING category {cat_id}")
            missing_cat_count += 1
        else:
            cat_data = cat_doc.to_dict()
            cat_user_id = cat_data.get("user_id")
            if cat_user_id != user_id:
                print(f"WARNING: Transaction {t.id} (User: {user_id}) points to Category {cat_id} (User: {cat_user_id})")

    print(f"\nTotal Transactions: {t_count}")
    print(f"Transactions with missing categories: {missing_cat_count}")

    if test_user_id:
        print(f"\n--- Testing Service Logic for User: {test_user_id} ---")
        try:
            print("Calling transaction_service.list_transactions...")
            txs = transaction_service.list_transactions(test_user_id)
            print(f"[SUCCESS] Successfully fetched {len(txs)} transactions via service.")
            # print([t.model_dump() for t in txs]) # Optional: print data
        except Exception as e:
            print(f"[ERROR] CRASH in transaction_service: {e}")
            import traceback
            traceback.print_exc()

        try:
            print("Calling dashboard_service.get_dashboard_data...")
            dash = dashboard_service.get_dashboard_data(test_user_id)
            print(f"[SUCCESS] Successfully fetched dashboard data via service.")
        except Exception as e:
            print(f"[ERROR] CRASH in dashboard_service: {e}")
            import traceback
            traceback.print_exc()
    else:
        print("Could not find any user_id to test services.")

if __name__ == "__main__":
    verify_data()
