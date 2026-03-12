import asyncio

from dotenv import load_dotenv

load_dotenv()

from app.api.routers.auth import APP_URL, LOGO_URL
from app.core.database import get_db
from app.services.email_service import email_service
from firebase_admin import auth


async def test():
    try:
        get_db()

        # Generate Firebase Reset Link
        action_code_settings = {
            "url": f"{APP_URL}/login",
            "handle_code_in_app": True,
        }

        email = "matheus.gruber123@gmail.com"
        print("Generating link...")
        link = auth.generate_password_reset_link(email, action_code_settings)
        print("Link:", link)
        print("Rendering template...")
        html_content = email_service.render_template(
            "auth_reset_password.html",
            {
                "logo_url": LOGO_URL,
                "email": email,
                "action_url": link,
                "app_name": "MonFinTrack",
            },
        )
        print("Template length:", len(html_content))
    except Exception as e:
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(test())
