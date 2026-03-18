import logging
import os

import stripe
from app.core.database import get_db
from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)

# Initialize Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY") or os.getenv("STRIPE_API_KEY")


class StripeService:
    def __init__(self):
        self._db = None
        self.prices = {
            "pro_monthly": os.getenv("STRIPE_PRICE_PRO_MONTHLY"),
            "pro_yearly": os.getenv("STRIPE_PRICE_PRO_YEARLY"),
            "premium_monthly": os.getenv("STRIPE_PRICE_PREMIUM_MONTHLY"),
            "premium_yearly": os.getenv("STRIPE_PRICE_PREMIUM_YEARLY"),
        }
        self.webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

        # Verify keys
        missing_keys = [k for k, v in self.prices.items() if not v]
        if missing_keys:
            logger.warning(
                f"⚠️ IDs de Preço do Stripe ausentes para: {missing_keys}. O checkout falhará para estes planos."
            )

        if not stripe.api_key:
            logger.critical("❌ STRIPE_SECRET_KEY não está configurada no ambiente!")

    @property
    def db(self):
        """Obtém a instância do banco de dados, garantindo que não seja None."""
        if self._db is None:
            self._db = get_db()

        if self._db is None:
            logger.error("❌ Firestore não disponível em StripeService")
            raise HTTPException(
                status_code=500,
                detail="Serviço de banco de dados temporariamente indisponível. Tente novamente em alguns instantes.",
            )
        return self._db

    def _get_price_id(self, plan: str):
        price_id = self.prices.get(plan)
        if not price_id:
            logger.error(
                f"❌ Plano '{plan}' não encontrado na configuração. Disponíveis: {list(self.prices.keys())}"
            )
            raise HTTPException(
                status_code=400,
                detail=f"Plano inválido ou configuração ausente para: {plan}",
            )
        return price_id

    def _get_or_create_customer(self, user_id: str):
        user_ref = self.db.collection("users").document(user_id)
        user_doc = user_ref.get()
        stripe_customer_id = None

        if user_doc.exists:
            user_data = user_doc.to_dict()
            stripe_customer_id = user_data.get("stripe_customer_id")

        if stripe_customer_id:
            try:
                # Verify customer exists in current Stripe mode
                stripe.Customer.retrieve(stripe_customer_id)
                return stripe_customer_id
            except stripe.error.InvalidRequestError as e:
                if "No such customer" in str(e):
                    logger.warning(
                        f"⚠️ Cliente Stripe {stripe_customer_id} não encontrado neste modo (Provavelmente troca de Teste/Live). Recriando para o usuário {user_id}."
                    )
                else:
                    logger.error(
                        f"❌ Erro ao recuperar cliente Stripe {stripe_customer_id}: {e}"
                    )
                    raise e
            except stripe.error.StripeError as e:
                logger.error(
                    f"❌ Erro de comunicação com Stripe ao recuperar cliente: {e}"
                )
                raise e

        # Create new customer
        try:
            customer = stripe.Customer.create(metadata={"user_id": user_id})
            stripe_customer_id = customer.id
            user_ref.set({"stripe_customer_id": stripe_customer_id}, merge=True)
            return stripe_customer_id
        except stripe.error.StripeError as e:
            logger.error(f"❌ Erro do Stripe ao criar cliente para {user_id}: {e}")
            raise HTTPException(
                status_code=400,
                detail=f"Erro no gateway de pagamento ao registrar cliente: {str(e)}",
            ) from e
        except Exception as exc:
            logger.error(
                f"❌ Erro inesperado ao criar cliente Stripe para o usuário {user_id}: {exc}"
            )
            raise HTTPException(
                status_code=500,
                detail=f"Falha interna ao preparar checkout: {str(exc)}",
            ) from exc

    def create_checkout_session(
        self, user_id: str, plan: str, success_url: str, cancel_url: str
    ):
        try:
            if not stripe.api_key:
                logger.error("❌ STRIPE_SECRET_KEY não está configurado!")
                raise HTTPException(
                    status_code=500,
                    detail="Erro de configuração no servidor de pagamentos. Chave de API ausente.",
                )

            # Pre-flight check: User must exist in DB
            user_ref = self.db.collection("users").document(user_id)
            if not user_ref.get().exists:
                logger.error(
                    f"❌ User '{user_id}' not found in Firestore. Setup might have failed."
                )
                raise HTTPException(
                    status_code=404,
                    detail="Usuário não encontrado no banco de dados. Tente fazer logout e login novamente.",
                )

            stripe_customer_id = self._get_or_create_customer(user_id)
            price_id = self._get_price_id(plan)

            logger.info(
                f"Criando sessão de checkout para usuário={user_id}, plano={plan}, cliente={stripe_customer_id}"
            )

            checkout_session = stripe.checkout.Session.create(
                customer=stripe_customer_id,
                payment_method_types=["card"],
                line_items=[
                    {
                        "price": price_id,
                        "quantity": 1,
                    }
                ],
                allow_promotion_codes=True,
                mode="subscription",
                success_url=success_url,
                cancel_url=cancel_url,
                client_reference_id=user_id,
                metadata={"user_id": user_id, "plan": plan},
                subscription_data={"metadata": {"user_id": user_id, "plan": plan}},
            )
            return {"sessionId": checkout_session["id"], "url": checkout_session["url"]}
        except stripe.error.StripeError as e:
            logger.error(f"❌ Erro do Stripe em create_checkout_session: {e}")
            raise HTTPException(
                status_code=400,
                detail=f"Erro no gateway de pagamento (Stripe): {str(e)}",
            ) from e
        except HTTPException:
            raise
        except Exception as e:
            logger.error(
                f"❌ Erro não tratado em create_checkout_session para o usuário {user_id}: {str(e)}",
                exc_info=True,
            )
            raise HTTPException(
                status_code=500,
                detail=f"Erro inesperado ao criar sessão de checkout: {str(e)}",
            ) from e

    def create_portal_session(self, user_id: str, return_url: str):
        try:
            user_ref = self.db.collection("users").document(user_id)
            user_doc = user_ref.get()
            if not user_doc.exists:
                logger.error(
                    f"❌ Sessão do Portal: Usuário '{user_id}' não encontrado no Firestore."
                )
                raise HTTPException(
                    status_code=404,
                    detail="Dados de perfil do usuário não encontrados.",
                )

            user_data = user_doc.to_dict()
            stripe_customer_id = user_data.get("stripe_customer_id")

            if not stripe_customer_id:
                logger.warning(
                    f"⚠️ Sessão do Portal: Usuário '{user_id}' não possui Stripe Customer ID associado."
                )
                raise HTTPException(
                    status_code=400,
                    detail="Você ainda não possui uma assinatura vinculada. Realize o primeiro pagamento para liberar o portal.",
                )

            portal_session = stripe.billing_portal.Session.create(
                customer=stripe_customer_id,
                return_url=return_url,
            )
            logger.info(f"Sessão do portal criada para o cliente {stripe_customer_id}")
            return {"url": portal_session["url"]}
        except stripe.error.StripeError as e:
            logger.error(
                f"❌ Stripe Error in create_portal_session for customer {stripe_customer_id}: {e}"
            )
            raise HTTPException(
                status_code=400, detail=f"Erro no portal de pagamentos: {str(e)}"
            ) from e
        except HTTPException:
            raise
        except Exception as e:
            logger.error(
                f"❌ Erro ao criar sessão do portal para o usuário {user_id}: {e}"
            )
            raise HTTPException(
                status_code=500,
                detail=f"Erro interno ao abrir portal do cliente: {str(e)}",
            ) from e

    async def handle_webhook(self, payload: bytes, sig_header: str):
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, self.webhook_secret
            )
        except ValueError as e:
            # Invalid payload
            raise HTTPException(status_code=400, detail="Invalid payload") from e
        except stripe.error.SignatureVerificationError as e:
            # Invalid signature
            raise HTTPException(status_code=400, detail="Invalid signature") from e

        if event["type"] == "checkout.session.completed":
            session = event["data"]["object"]
            await self._handle_checkout_completed(session)
        elif event["type"] in [
            "customer.subscription.updated",
            "customer.subscription.created",
        ]:
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
            user_ref.set(
                {
                    "stripe_customer_id": customer_id,
                    "stripe_subscription_id": subscription_id,
                },
                merge=True,
            )
            logger.info(f"Usuário {user_id} vinculado ao cliente {customer_id}")

        # Checkout completed means payment was successful.
        # Retrieve the updated subscription to ensure we capture the 'active' status and update the tier correctly.
        if subscription_id:
            try:
                subscription = stripe.Subscription.retrieve(subscription_id)
                await self._handle_subscription_updated(subscription)
            except Exception as e:
                logger.error(
                    f"Falha ao recuperar assinatura {subscription_id} após checkout: {e}"
                )
                # Fallback: infer tier from session-level metadata and update Firestore
                session_metadata = session.get("metadata") or {}
                plan = session_metadata.get("plan") if isinstance(session_metadata, dict) else None
                if plan and user_id:
                    tier = "premium" if "premium" in plan else ("pro" if "pro" in plan else "free")
                    try:
                        user_ref = self.db.collection("users").document(user_id)
                        user_ref.set(
                            {"subscription_tier": tier, "subscription_status": "active"},
                            merge=True,
                        )
                        prefs_ref = self.db.collection("user_preferences").document(user_id)
                        prefs_doc = prefs_ref.get()
                        if prefs_doc.exists:
                            current_version = prefs_doc.to_dict().get("version", 0)
                            prefs_ref.set(
                                {"subscription_tier": tier, "version": current_version + 1},
                                merge=True,
                            )
                        logger.info(
                            f"Tier atualizado via fallback de metadados para {user_id}: {tier}"
                        )
                    except Exception as fb_err:
                        logger.error(f"Fallback de metadados falhou para {user_id}: {fb_err}")
                        raise HTTPException(
                            status_code=500, detail="Webhook processing failed"
                        ) from fb_err
                else:
                    raise HTTPException(
                        status_code=500, detail="Webhook processing failed"
                    ) from e

    async def _handle_subscription_updated(self, subscription):
        customer_id = subscription.get("customer")
        status = subscription.get("status")

        # Robust status extraction for different object types
        if not status and hasattr(subscription, "status"):
            status = subscription.status

        if not status:
            logger.warning(
                f"⚠️ Status da assinatura não encontrado no objeto para o cliente {customer_id}. Assinatura: {subscription}"
            )

        current_period_end = subscription.get("current_period_end")

        # Try to get user_id from metadata first (faster, avoids query)
        user_id = subscription.get("metadata", {}).get("user_id")

        # Safely extract price ID from subscription items
        try:
            items_data = subscription.get("items", {}).get("data", [])
            if not items_data:
                logger.warning(
                    f"Assinatura do cliente {customer_id} não possui itens, definindo como 'free'"
                )
                tier = "free"
            else:
                plan_id = items_data[0]["price"]["id"]
                tier = self._infer_tier_from_price(plan_id)
        except (KeyError, IndexError, TypeError) as e:
            logger.error(f"Falha ao extrair preço da assinatura: {e}")
            tier = "free"

        # If user_id not in metadata, fall back to query (legacy/fallback)
        if not user_id:
            logger.info(
                f"User ID not in metadata, querying for customer_id: {customer_id}"
            )
            users_ref = (
                self.db.collection("users")
                .where("stripe_customer_id", "==", customer_id)
                .limit(1)
            )
            docs = list(users_ref.stream())
            if docs:
                user_id = docs[0].id

        if user_id:
            user_ref = self.db.collection("users").document(user_id)
            effective_tier = tier if status in ["active", "trialing"] else "free"
            update_data = {
                "subscription_status": status,
                "current_period_end": current_period_end,
                "subscription_tier": effective_tier,
            }
            user_ref.set(update_data, merge=True)

            # Update user_preferences (consumed by frontend with version-based cache)
            prefs_ref = self.db.collection("user_preferences").document(user_id)
            prefs_doc = prefs_ref.get()
            if prefs_doc.exists:
                current_version = prefs_doc.to_dict().get("version", 0)
                prefs_ref.set(
                    {
                        "subscription_tier": effective_tier,
                        "version": current_version + 1,
                    },
                    merge=True,
                )

            logger.info(
                f"Assinatura atualizada para o usuário {user_id}: nível={effective_tier}, status={status}"
            )
        else:
            logger.error(
                f"Não foi possível encontrar um usuário para o cliente Stripe {customer_id}"
            )

    async def _handle_subscription_deleted(self, subscription):
        customer_id = subscription.get("customer")
        users_ref = (
            self.db.collection("users")
            .where("stripe_customer_id", "==", customer_id)
            .limit(1)
        )
        docs = list(users_ref.stream())

        if docs:
            user_ref = docs[0].reference
            user_id = user_ref.id
            user_ref.set(
                {"subscription_status": "canceled", "subscription_tier": "free"},
                merge=True,
            )

            prefs_ref = self.db.collection("user_preferences").document(user_id)
            prefs_doc = prefs_ref.get()
            if prefs_doc.exists:
                current_version = prefs_doc.to_dict().get("version", 0)
                prefs_ref.set(
                    {"subscription_tier": "free", "version": current_version + 1},
                    merge=True,
                )

            logger.info(f"Assinatura cancelada para o cliente {customer_id}")

    def cancel_all_subscriptions(self, user_id: str):
        """Cancela todas as assinaturas ativas de um usuário antes de deletar a conta."""
        user_ref = self.db.collection("users").document(user_id)
        user_doc = user_ref.get()

        if not user_doc.exists:
            return

        user_data = user_doc.to_dict()
        stripe_customer_id = user_data.get("stripe_customer_id")

        if not stripe_customer_id:
            return

        try:
            # List all subscriptions for this customer
            subscriptions = stripe.Subscription.list(customer=stripe_customer_id, status="active")
            for sub in subscriptions.data:
                stripe.Subscription.delete(sub.id)
                logger.info(f"Assinatura {sub.id} cancelada para o usuário {user_id}")
        except Exception as e:
            logger.error(f"Erro ao cancelar assinaturas Stripe para {user_id}: {e}")
            # Non-blocking error, we still want to allow account deletion

    def _infer_tier_from_price(self, price_id: str) -> str:
        # Invert the config map
        for plan_name, pid in self.prices.items():
            if pid == price_id:
                if "premium" in plan_name:
                    return "premium"
                if "pro" in plan_name:
                    return "pro"
        return "free"
