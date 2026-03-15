
from google import genai
import os

api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    print("No API Key found")
else:
    client = genai.Client(api_key=api_key)
    print("Available Models:")
    try:
        # Use the models.list method in the new SDK
        for m in client.models.list():
            print(f"- {m.name} (Supported: {m.supported_generation_methods})")
    except Exception as e:
        print(f"Error listing models: {e}")
