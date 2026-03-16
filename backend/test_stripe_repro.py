import logging

import stripe
from app.services.stripe_service import StripeService
from dotenv import load_dotenv

# Configure logging to stdout
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()


def test_repro():
    user_id = "ukZ1mb73OTOC7bQjdEIdFcRADK72"  # User found in check_users.py
    plan = "pro_monthly"
    success_url = "http://localhost:4200/dashboard?payment=success"
    cancel_url = "http://localhost:4200/pricing?payment=canceled"

    service = StripeService()
    print(f"Testing for User ID: {user_id}")
    print(f"Stripe API Key starts with: {stripe.api_key[:10]}...")

    try:
        result = service.create_checkout_session(user_id, plan, success_url, cancel_url)
        print("✅ SUCCESS!")
        print(f"Result: {result}")
    except Exception as e:
        print(f"❌ FAILED: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    test_repro()
