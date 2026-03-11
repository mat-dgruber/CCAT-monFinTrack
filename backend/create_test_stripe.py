import os
import stripe
from dotenv import load_dotenv

load_dotenv(".env")
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

try:
    # Pro
    pro_prod = stripe.Product.create(name="Plano Pro (Test)")
    pro_month = stripe.Price.create(
        product=pro_prod.id,
        unit_amount=3000,
        currency="brl",
        recurring={"interval": "month"}
    )
    pro_year = stripe.Price.create(
        product=pro_prod.id,
        unit_amount=30000,
        currency="brl",
        recurring={"interval": "year"}
    )
    
    # Premium
    prem_prod = stripe.Product.create(name="Plano Premium (Test)")
    prem_month = stripe.Price.create(
        product=prem_prod.id,
        unit_amount=5000,
        currency="brl",
        recurring={"interval": "month"}
    )
    prem_year = stripe.Price.create(
        product=prem_prod.id,
        unit_amount=50000,
        currency="brl",
        recurring={"interval": "year"}
    )
    
    print(f"STRIPE_PRICE_PRO_MONTHLY={pro_month.id}")
    print(f"STRIPE_PRICE_PRO_YEARLY={pro_year.id}")
    print(f"STRIPE_PRICE_PREMIUM_MONTHLY={prem_month.id}")
    print(f"STRIPE_PRICE_PREMIUM_YEARLY={prem_year.id}")

except Exception as e:
    import traceback
    traceback.print_exc()
