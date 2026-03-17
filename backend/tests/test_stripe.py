from dotenv import load_dotenv

load_dotenv(".env")

from app.services.stripe_service import StripeService


def test_stripe():
    try:
        service = StripeService()
        url = "http://localhost:4200/pricing?success=true"
        res = service.create_checkout_session(
            user_id="test_user_123", plan="pro_monthly", success_url=url, cancel_url=url
        )
        print("Success:", res)
    except Exception:
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    test_stripe()
