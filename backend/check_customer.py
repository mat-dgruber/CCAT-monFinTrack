import firebase_admin
from firebase_admin import credentials, firestore

if not firebase_admin._apps:
    cred = credentials.Certificate("app/certs/serviceAccountKey.json")
    firebase_admin.initialize_app(cred)

db = firestore.client()
user_id = "ukZ1mb73OTOC7bQjdEIdFcRADK72"

user_doc = db.collection("users").document(user_id).get()
prefs_doc = db.collection("user_preferences").document(user_id).get()

if user_doc.exists:
    print(f"User: {user_doc.to_dict()}")
if prefs_doc.exists:
    print(f"Prefs: {prefs_doc.to_dict()}")
