import asyncio
from unittest.mock import MagicMock, patch

import pytest
import stripe
from app.services.stripe_service import StripeService
from fastapi import HTTPException


@pytest.fixture
def mock_db():
    return MagicMock()


@pytest.fixture
def mock_env(monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_123")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_123")
    monkeypatch.setenv("STRIPE_PRICE_PRO_MONTHLY", "price_pro_m")
    monkeypatch.setenv("STRIPE_PRICE_PRO_YEARLY", "price_pro_y")
    monkeypatch.setenv("STRIPE_PRICE_PREMIUM_MONTHLY", "price_prem_m")
    monkeypatch.setenv("STRIPE_PRICE_PREMIUM_YEARLY", "price_prem_y")


@pytest.fixture
def stripe_service(mock_db, mock_env):
    with patch("app.services.stripe_service.get_db", return_value=mock_db):
        service = StripeService()
        # Pre-set self._db to avoid calling get_db() again after the patch is gone
        service._db = mock_db
        return service


def test_infer_tier_premium(stripe_service):
    assert stripe_service._infer_tier_from_price("price_prem_m") == "premium"
    assert stripe_service._infer_tier_from_price("price_prem_y") == "premium"


def test_infer_tier_pro(stripe_service):
    assert stripe_service._infer_tier_from_price("price_pro_m") == "pro"
    assert stripe_service._infer_tier_from_price("price_pro_y") == "pro"


def test_infer_tier_unknown(stripe_service):
    assert stripe_service._infer_tier_from_price("price_unknown") == "free"


def test_get_price_id_valid(stripe_service):
    assert stripe_service._get_price_id("pro_monthly") == "price_pro_m"
    assert stripe_service._get_price_id("premium_yearly") == "price_prem_y"


def test_get_price_id_invalid(stripe_service):
    with pytest.raises(HTTPException) as exc_info:
        stripe_service._get_price_id("invalid_plan")
    assert exc_info.value.status_code == 400


@patch("app.services.stripe_service.stripe.Customer.retrieve")
@patch("app.services.stripe_service.stripe.checkout.Session.create")
def test_create_checkout_existing_customer(
    mock_session_create, mock_customer_retrieve, stripe_service, mock_db
):
    # Setup user with customer ID
    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {"stripe_customer_id": "cus_123"}
    mock_db.collection().document().get.return_value = mock_doc

    mock_session_create.return_value = {"id": "cs_123", "url": "http://checkout.com"}
    mock_customer_retrieve.return_value = MagicMock(id="cus_123")

    result = stripe_service.create_checkout_session(
        "user_123", "pro_monthly", "http://success", "http://cancel"
    )

    # Assert
    assert result == {"sessionId": "cs_123", "url": "http://checkout.com"}
    mock_session_create.assert_called_once()
    mock_customer_retrieve.assert_called_once_with("cus_123")
    kwargs = mock_session_create.call_args.kwargs
    assert kwargs["customer"] == "cus_123"
    assert kwargs["line_items"][0]["price"] == "price_pro_m"


@patch("app.services.stripe_service.stripe.Customer.create")
@patch("app.services.stripe_service.stripe.checkout.Session.create")
def test_create_checkout_new_customer(
    mock_session_create, mock_customer_create, stripe_service, mock_db
):
    # Setup user without customer ID
    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {}  # No stripe_customer_id
    mock_db.collection().document().get.return_value = mock_doc

    mock_customer = MagicMock()
    mock_customer.id = "cus_new_123"
    mock_customer_create.return_value = mock_customer

    mock_session_create.return_value = {"id": "cs_123", "url": "http://checkout.com"}

    result = stripe_service.create_checkout_session(
        "user_123", "premium_monthly", "http://success", "http://cancel"
    )

    assert result == {"sessionId": "cs_123", "url": "http://checkout.com"}
    mock_customer_create.assert_called_once_with(metadata={"user_id": "user_123"})
    # verify save customer id to db
    mock_db.collection().document().set.assert_called_with(
        {"stripe_customer_id": "cus_new_123"}, merge=True
    )

    kwargs = mock_session_create.call_args.kwargs
    assert kwargs["customer"] == "cus_new_123"


@patch("app.services.stripe_service.stripe.billing_portal.Session.create")
def test_create_portal_no_customer(mock_portal_create, stripe_service, mock_db):
    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {}  # No stripe_customer_id
    mock_db.collection().document().get.return_value = mock_doc

    with pytest.raises(HTTPException) as exc_info:
        stripe_service.create_portal_session("user_123", "http://return")
    assert exc_info.value.status_code == 400
    assert "assinatura vinculada" in exc_info.value.detail.lower()


def test_create_portal_no_user(stripe_service, mock_db):
    mock_doc = MagicMock()
    mock_doc.exists = False
    mock_db.collection().document().get.return_value = mock_doc

    with pytest.raises(HTTPException) as exc_info:
        stripe_service.create_portal_session("user_123", "http://return")
    assert exc_info.value.status_code == 404
    assert "perfil do usuário" in exc_info.value.detail.lower()


def test_handle_subscription_updated_active(stripe_service, mock_db):
    subscription = {
        "customer": "cus_123",
        "status": "active",
        "current_period_end": 1234567890,
        "items": {"data": [{"price": {"id": "price_prem_m"}}]},
    }

    # Mock user document found by customer_id
    mock_user_doc = MagicMock()
    mock_user_doc.reference.id = "user_123"
    mock_db.collection.return_value.where.return_value.limit.return_value.stream.return_value = [mock_user_doc]

    # Mock user preferences
    mock_prefs_doc = MagicMock()
    mock_prefs_doc.exists = True
    mock_prefs_doc.to_dict.return_value = {"version": 5}
    mock_db.collection.return_value.document.return_value.get.return_value = mock_prefs_doc

    asyncio.run(stripe_service._handle_subscription_updated(subscription))

    # Verification user update
    # Note: user_ref is retrieved via self.db.collection("users").document(user_id)
    mock_db.collection().document().set.assert_any_call(
        {
            "subscription_status": "active",
            "current_period_end": 1234567890,
            "subscription_tier": "premium",
        },
        merge=True,
    )

    # Verification prefs update
    # We should look for the call with 'version' in it to distinguish from user update
    prefs_set_calls = [call for call in mock_db.collection().document().set.call_args_list if "version" in call[0][0]]
    assert len(prefs_set_calls) > 0
    assert prefs_set_calls[0][0][0]["subscription_tier"] == "premium"
    assert prefs_set_calls[0][0][0]["version"] == 6


def test_handle_subscription_updated_canceled(stripe_service, mock_db):
    subscription = {
        "customer": "cus_123",
        "status": "canceled",
        "current_period_end": 1234567890,
        "items": {"data": [{"price": {"id": "price_prem_m"}}]},
    }

    mock_user_doc = MagicMock()
    mock_user_doc.reference.id = "user_123"
    mock_db.collection().where().limit().stream.return_value = [mock_user_doc]

    # mock preferences
    mock_prefs_doc = MagicMock()
    mock_prefs_doc.exists = True
    mock_prefs_doc.to_dict.return_value = {"version": 2}
    mock_db.collection().document().get.return_value = mock_prefs_doc

    asyncio.run(stripe_service._handle_subscription_updated(subscription))

    mock_db.collection().document().set.assert_any_call(
        {
            "subscription_status": "canceled",
            "current_period_end": 1234567890,
            "subscription_tier": "free",
        },
        merge=True,
    )

    prefs_set_calls = [call for call in mock_db.collection().document().set.call_args_list if "version" in call[0][0]]
    assert len(prefs_set_calls) > 0
    assert prefs_set_calls[0][0][0]["subscription_tier"] == "free"
    assert prefs_set_calls[0][0][0]["version"] == 3


def test_handle_subscription_updated_empty_items(stripe_service, mock_db):
    subscription = {
        "customer": "cus_123",
        "status": "active",
        "current_period_end": 1234567890,
        "items": {"data": []},
    }

    mock_user_doc = MagicMock()
    mock_user_doc.reference.id = "user_123"
    mock_user_doc.id = "user_123"
    mock_db.collection().where().limit().stream.return_value = [mock_user_doc]

    mock_prefs_doc = MagicMock()
    mock_prefs_doc.exists = True
    mock_prefs_doc.to_dict.return_value = {"version": 2}
    mock_db.collection().document().get.return_value = mock_prefs_doc

    asyncio.run(stripe_service._handle_subscription_updated(subscription))

    mock_db.collection().document().set.assert_any_call(
        {
            "subscription_status": "active",
            "current_period_end": 1234567890,
            "subscription_tier": "free",  # Default to free on empty items
        },
        merge=True,
    )


def test_handle_subscription_deleted(stripe_service, mock_db):
    subscription = {"customer": "cus_123"}

    mock_user_doc = MagicMock()
    mock_user_doc.reference.id = "user_123"
    mock_db.collection().where().limit().stream.return_value = [mock_user_doc]

    mock_prefs_doc = MagicMock()
    mock_prefs_doc.exists = True
    mock_prefs_doc.to_dict.return_value = {"version": 10}
    mock_db.collection().document().get.return_value = mock_prefs_doc

    asyncio.run(stripe_service._handle_subscription_deleted(subscription))

    # user_ref is docs[0].reference so mock_user_doc.reference.set is correct
    mock_user_doc.reference.set.assert_called_once_with(
        {"subscription_status": "canceled", "subscription_tier": "free"}, merge=True
    )

    prefs_set_calls = [call for call in mock_db.collection().document().set.call_args_list if "version" in call[0][0]]
    assert len(prefs_set_calls) > 0
    assert prefs_set_calls[0][0][0]["subscription_tier"] == "free"
    assert prefs_set_calls[0][0][0]["version"] == 11


@patch("app.services.stripe_service.StripeService._handle_subscription_updated")
@patch("app.services.stripe_service.stripe.Subscription.retrieve")
def test_handle_checkout_completed(
    mock_retrieve, mock_handle_updated, stripe_service, mock_db
):
    session = {
        "client_reference_id": "user_123",
        "customer": "cus_123",
        "subscription": "sub_123",
    }

    mock_retrieve.return_value = {"id": "sub_123", "status": "active"}

    asyncio.run(stripe_service._handle_checkout_completed(session))

    # Assert DB update
    mock_db.collection().document().set.assert_called_once_with(
        {"stripe_customer_id": "cus_123", "stripe_subscription_id": "sub_123"},
        merge=True,
    )

    # Assert retrieve called
    mock_retrieve.assert_called_once_with("sub_123")

    # Assert handle updated called
    mock_handle_updated.assert_called_once_with({"id": "sub_123", "status": "active"})


@patch("app.services.stripe_service.stripe.Webhook.construct_event")
def test_webhook_invalid_signature(mock_construct_event, stripe_service):
    mock_construct_event.side_effect = stripe.error.SignatureVerificationError(
        "invalid", "sig"
    )

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(stripe_service.handle_webhook(b"payload", "invalid_sig"))
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Invalid signature"


@patch("app.services.stripe_service.stripe.Webhook.construct_event")
def test_webhook_invalid_payload(mock_construct_event, stripe_service):
    mock_construct_event.side_effect = ValueError("invalid")

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(stripe_service.handle_webhook(b"invalid_payload", "sig"))
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Invalid payload"
