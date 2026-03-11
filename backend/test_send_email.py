import asyncio
import sys
from dotenv import load_dotenv
load_dotenv()

from firebase_admin import auth
from app.core.database import get_db
from app.api.routers.auth import LOGO_URL
from app.services.email_service import email_service

async def test():
    print("Starting test...", file=sys.stderr)
    try:
        get_db()
        print("DB initialized.", file=sys.stderr)

        action_code_settings = auth.ActionCodeSettings(
            url="http://localhost:4200/login",
            handle_code_in_app=True,
        )
        
        email = "matheus.gruber123@gmail.com"
        print("Generating link...", file=sys.stderr)
        link = auth.generate_password_reset_link(email, action_code_settings=action_code_settings)
        print("Link:", link, file=sys.stderr)
        
        print("Rendering template...", file=sys.stderr)
        html_content = email_service.render_template(
            "auth_reset_password.html",
            {
                "logo_url": LOGO_URL,
                "email": email,
                "action_url": link,
                "app_name": "MonFinTrack"
            }
        )
        print("Template length:", len(html_content), file=sys.stderr)

        print("Sending email...", file=sys.stderr)
        await email_service.send_email(
            subject="Test subject - Redefinir senha",
            recipients=[email],
            body=html_content
        )
        print("Test passed successfully! Email sent.", file=sys.stderr)
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test())
