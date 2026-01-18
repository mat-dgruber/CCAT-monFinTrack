import stripe
import os
import logging
from fastapi import HTTPException
from app.core.database import get_db
from google.cloud import firestore

# Configure logging
logger = logging.getLogger(__name__)

# Initialize Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY") or os.getenv("STRIPE_API_KEY")

class StripeService:
    def __init__(self):
        self.db = get_db()
        self.prices = {
            "pro_monthly": os.getenv("STRIPE_PRICE_PRO_MONTHLY"),
            "pro_yearly": os.getenv("STRIPE_PRICE_PRO_YEARLY"),
            "premium_monthly": os.getenv("STRIPE_PRICE_PREMIUM_MONTHLY"),
            "premium_yearly": os.getenv("STRIPE_PRICE_PREMIUM_YEARLY"),
        }
        self.webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    def _get_price_id(self, plan: str):
        price_id = self.prices.get(plan)
        if not price_id:
            raise HTTPException(status_code=400, detail=f"Invalid plan or missing configuration for: {plan}")
        return price_id

    def create_checkout_session(self, user_id: str, plan: str, success_url: str, cancel_url: str):
        try:
            # Get user to check for existing customer_id
            user_ref = self.db.collection("users").document(user_id)
            user_doc = user_ref.get()
            stripe_customer_id = None
            
            if user_doc.exists:
                user_data = user_doc.to_dict()
                stripe_customer_id = user_data.get("stripe_customer_id")

            # Create Customer if doesn't exist (or let Checkout create it if we don't pass it, 
            # but better to have it linked)
            customer_kwargs = {}
            if stripe_customer_id:
                customer_kwargs["customer"] = stripe_customer_id
            else:
                 # We can let checkout create it, or create it upfront. 
                 # Letting checkout create it is easier, but we need to capture it in webhook.
                 # For now, we'll suggest creating a new customer in Checkout if one doesn't exist
                 # by NOT passing 'customer'.
                 # Actually, passing 'client_reference_id' is crucial for webhook matching if no customer yet.
                 pass

            checkout_session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                line_items=[
                    {
                        "price": self._get_price_id(plan),
                        "quantity": 1,
                    }
                ],
                allow_promotion_codes=True,
                mode="subscription",
                success_url=success_url,
                cancel_url=cancel_url,
                client_reference_id=user_id,
                subscription_data={
                    "metadata": {
                        "user_id": user_id,
                        "plan": plan
                    }
                },
                **customer_kwargs
            )
            return {"sessionId": checkout_session["id"], "url": checkout_session["url"]}
        except Exception as e:
            logger.error(f"Error creating checkout session: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    def create_portal_session(self, user_id: str, return_url: str):
        try:
            user_ref = self.db.collection("users").document(user_id)
            user_doc = user_ref.get()
            if not user_doc.exists:
                raise HTTPException(status_code=404, detail="User not found")
            
            user_data = user_doc.to_dict()
            stripe_customer_id = user_data.get("stripe_customer_id")

            if not stripe_customer_id:
                raise HTTPException(status_code=400, detail="User does not have a Stripe Customer ID")

            portal_session = stripe.billing_portal.Session.create(
                customer=stripe_customer_id,
                return_url=return_url,
            )
            return {"url": portal_session["url"]}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error creating portal session: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def handle_webhook(self, payload: bytes, sig_header: str):
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, self.webhook_secret
            )
        except ValueError as e:
            # Invalid payload
            raise HTTPException(status_code=400, detail="Invalid payload")
        except stripe.error.SignatureVerificationError as e:
            # Invalid signature
            raise HTTPException(status_code=400, detail="Invalid signature")

        # Handle the event
        if event["type"] == "checkout.session.completed":
            session = event["data"]["object"]
            await self._handle_checkout_completed(session)
        elif event["type"] == "customer.subscription.updated":
            subscription = event["data"]["object"]
            await self._handle_subscription_updated(subscription)
        elif event["type"] == "customer.subscription.deleted":
            subscription = event["data"]["object"]
            await self._handle_subscription_deleted(subscription)

        return {"status": "success"}

    async def _handle_checkout_completed(self, session):
        user_id = session.get("client_reference_id")
        customer_id = session.get("customer")
        subscription_id = session.get("subscription")
        
        if user_id and customer_id:
            # Update user with Stripe ID
            user_ref = self.db.collection("users").document(user_id)
            user_ref.set({
                "stripe_customer_id": customer_id,
                "stripe_subscription_id": subscription_id
            }, merge=True)
            logger.info(f"Linked user {user_id} to customer {customer_id}")

    async def _handle_subscription_updated(self, subscription):
        customer_id = subscription.get("customer")
        status = subscription.get("status")
        current_period_end = subscription.get("current_period_end")
        
        # Determine tier based on price ID (reverse lookup or metadata)
        # Assuming we store metadata or infer from price
        plan_id = subscription["items"]["data"][0]["price"]["id"]
        tier = self._infer_tier_from_price(plan_id)
        
        # Find user by customer_id
        # NOTE: This requires a query, which needs an index on 'stripe_customer_id'
        users_ref = self.db.collection("users").where("stripe_customer_id", "==", customer_id).limit(1)
        docs = list(users_ref.stream())
        
        if docs:
            user_ref = docs[0].reference
            update_data = {
                "subscription_status": status,
                "current_period_end": current_period_end,
                "subscription_tier": tier if status in ["active", "trialing"] else "free" 
            }
            # Only downgrade if canceled/unpaid, otherwise keep tier
            if status not in ["active", "trialing"]:
                 update_data["subscription_tier"] = "free"
            else:
                 update_data["subscription_tier"] = tier

            user_ref.set(update_data, merge=True)
            logger.info(f"Updated subscription for customer {customer_id} to status {status}")

    async def _handle_subscription_deleted(self, subscription):
        customer_id = subscription.get("customer")
        users_ref = self.db.collection("users").where("stripe_customer_id", "==", customer_id).limit(1)
        docs = list(users_ref.stream())
        
        if docs:
            user_ref = docs[0].reference
            user_ref.set({
                "subscription_status": "canceled",
                "subscription_tier": "free"
            }, merge=True)
            logger.info(f"Canceled subscription for customer {customer_id}")

    def _infer_tier_from_price(self, price_id: str) -> str:
        # Invert the config map
        for plan_name, pid in self.prices.items():
            if pid == price_id:
                if "premium" in plan_name:
                    return "premium"
                if "pro" in plan_name:
                    return "pro"
        return "free"
