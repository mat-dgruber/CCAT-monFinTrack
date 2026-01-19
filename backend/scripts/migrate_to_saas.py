import sys
import os
import argparse
from typing import List

# Ensure we can import app modules - Adding project root to sys.path
# Assuming script is in backend/scripts/ and app is in backend/app/
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(project_root)

# Now we can import from app
try:
    from app.core.database import get_db
    from google.cloud import firestore
except ImportError as e:
    print(f"Error importing modules: {e}")
    print(f"PYTHONPATH: {sys.path}")
    print("Please run this script using 'uv run scripts/migrate_to_saas.py <uid>' from the backend directory.")
    sys.exit(1)

COLLECTIONS = [
    "transactions",
    "accounts",
    "categories",
    "budgets",
    "recurrences",
    "seasonal_incomes",
    "debts",
    "invoices"
]

def migrate(target_uid: str, dry_run: bool = True):
    print(f"🚀 Starting Migration to SaaS Mode")
    print(f"Target Owner UID: {target_uid}")
    print(f"Dry Run: {dry_run}")
    
    try:
        db = get_db()
    except Exception as e:
        print(f"❌ Failed to connect to DB: {e}")
        return
    
    total_updated = 0
    
    for collection_name in COLLECTIONS:
        print(f"\n📂 Checking collection: {collection_name}...")
        try:
            docs = list(db.collection(collection_name).stream())
        except Exception as e:
            print(f"  ⚠️ Error accessing collection {collection_name}: {e}")
            continue
            
        if not docs:
            print("  (Empty collection)")
            continue

        batch = db.batch()
        count = 0
        updated_in_coll = 0
        
        for doc in docs:
            data = doc.to_dict()
            if 'user_id' not in data or not data['user_id']:
                # Needs update
                if dry_run:
                    doc_preview = f"{doc.id} ({data.get('name') or data.get('title') or 'No Title'})"
                    print(f"  [DRY] Would update {doc_preview} -> user_id={target_uid}")
                else:
                    batch.update(doc.reference, {"user_id": target_uid})
                    count += 1
                updated_in_coll += 1
            
            # Commit batch every 400 writes
            if count >= 400:
                print(f"  Commiting batch of 400...")
                batch.commit()
                batch = db.batch()
                count = 0
        
        if count > 0 and not dry_run:
            batch.commit()
            print(f"  Committed remaining {count} updates.")
            
        print(f"✅ {collection_name}: {updated_in_coll} documents identified/updated.")
        total_updated += updated_in_coll
        
    print(f"\n🎉 Migration Complete!")
    print(f"Total documents targeted: {total_updated}")
    if dry_run:
        print("NOTE: This was a DRY RUN. No changes were made.")
        print("Run with --execute to apply changes.")
    else:
        print("SUCCESS: Changes applied to Firestore.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate legacy data to SaaS (add user_id owner)")
    parser.add_argument("uid", help="The Firebase UID of the owner (Admin)")
    parser.add_argument("--execute", action="store_true", help="Actually perform the updates")
    
    args = parser.parse_args()
    
    migrate(args.uid, dry_run=not args.execute)
