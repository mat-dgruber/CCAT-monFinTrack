import asyncio

from app.api.routers.auth import LOGO_URL
from app.services.email_service import email_service


async def test():
    try:
        html_content = email_service.render_template(
            "auth_reset_password.html",
            {
                "logo_url": LOGO_URL,
                "email": "test@example.com",
                "action_url": "http://localhost",
                "app_name": "MonFinTrack",
            },
        )
        print("Template rendered successfully.")
        print(html_content[:100])

        await email_service.send_email(
            subject="Test subject",
            recipients=["matheus.gruber123@gmail.com"],
            body=html_content,
        )
        print(
            "Email sent (or queued for background task successfully if you run via API)."
        )
    except Exception as e:
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(test())
