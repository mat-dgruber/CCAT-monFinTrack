import asyncio
import pytest

from dotenv import load_dotenv

load_dotenv()

# We need to ensure app/core/firebase.py is imported or firebase is initialized
from app.core.database import get_db
from firebase_admin import auth


@pytest.mark.anyio
async def test():
    try:
        # Initialize db/firebase
        get_db()

        action_code_settings = {
            "url": "http://localhost:4200/login",
            "handle_code_in_app": True,
        }

        email = "matheus.gruber123@gmail.com"
        print(f"Generating reset link for {email}...")
        link = auth.generate_password_reset_link(email, action_code_settings)
        print("Success:", link)
    except Exception:
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(test())
