import firebase_admin
from firebase_admin import credentials, firestore

if not firebase_admin._apps:
    cred = credentials.Certificate("app/certs/serviceAccountKey.json")
    firebase_admin.initialize_app(cred)

db = firestore.client()
users = db.collection("users").stream()

print("User Preferences:")
for user in users:
    prefs_doc = db.collection("user_preferences").document(user.id).get()
    if prefs_doc.exists:
        print(f"User ID: {user.id}")
        config = prefs_doc.to_dict()
        print(f"  Tier: {config.get('subscription_tier', 'None')}")
        print(f"  Full Config: {config}")
    else:
        print(f"User ID: {user.id} - No preferences found")
