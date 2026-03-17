import firebase_admin
from firebase_admin import credentials, firestore

if not firebase_admin._apps:
    cred = credentials.Certificate("app/certs/serviceAccountKey.json")
    firebase_admin.initialize_app(cred)

db = firestore.client()
user_id = "ukZ1mb73OTOC7bQjdEIdFcRADK72"

prefs_ref = db.collection("user_preferences").document(user_id)
doc = prefs_ref.get()

if doc.exists:
    current_version = doc.to_dict().get("version", 0)
    prefs_ref.update({"subscription_tier": "free", "version": current_version + 1})
    print(f"User {user_id} tier updated to 'free' (version {current_version + 1})")
else:
    print(f"Preferences for user {user_id} not found.")
