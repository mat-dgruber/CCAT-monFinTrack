from dotenv import load_dotenv
import asyncio
load_dotenv()

from firebase_admin import auth
# We need to ensure app/core/firebase.py is imported or firebase is initialized
from app.core.database import get_db

async def test():
    try:
        # Initialize db/firebase
        get_db()

        action_code_settings = {
            'url': f"http://localhost:4200/login",
            'handle_code_in_app': True,
        }
        
        email = "matheus.gruber123@gmail.com"
        print(f"Generating reset link for {email}...")
        link = auth.generate_password_reset_link(email, action_code_settings)
        print("Success:", link)
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test())
