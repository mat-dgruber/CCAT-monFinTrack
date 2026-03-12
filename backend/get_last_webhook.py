import os

import stripe
from dotenv import load_dotenv

load_dotenv()
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

events = stripe.Event.list(limit=5)
for event in events.data:
    if event.type in ["customer.subscription.created", "customer.subscription.updated"]:
        sub = event.data.object
        price_id = sub["items"]["data"][0]["price"]["id"]
        print(f"Event: {event.type}")
        print(f"Customer: {sub.customer}")
        print(f"Price ID: {price_id}")

        # Test infer logic
        prices = {
            "pro_monthly": os.getenv("STRIPE_PRICE_PRO_MONTHLY"),
            "pro_yearly": os.getenv("STRIPE_PRICE_PRO_YEARLY"),
            "premium_monthly": os.getenv("STRIPE_PRICE_PREMIUM_MONTHLY"),
            "premium_yearly": os.getenv("STRIPE_PRICE_PREMIUM_YEARLY"),
        }
        print(f"Prices Map: {prices}")
        tier = "free"
        for plan_name, pid in prices.items():
            if pid == price_id:
                if "premium" in plan_name:
                    tier = "premium"
                if "pro" in plan_name:
                    tier = "pro"
        print(f"Inferred Tier: {tier}")
        print("-" * 40)
