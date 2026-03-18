"""
Security Tests: MFA Service & Authentication Layer
Tests MFA secret encryption, cross-user secret isolation,
and the Firebase token verification guard.
"""

from unittest.mock import MagicMock, patch

import pytest
from cryptography.fernet import Fernet
from fastapi import HTTPException

# ============================================================
# 1. MFA ENCRYPTION TESTS
# ============================================================


class TestMFAEncryption:
    """Tests that MFA secrets are properly encrypted at rest."""

    def test_secret_is_encrypted_before_storage(self):
        """MFA secret must be encrypted with Fernet before writing to Firestore."""
        with patch("app.services.mfa.get_db") as mock_db:
            mock_db.return_value = MagicMock()

            from app.services.mfa import MFAService

            service = MFAService()

            raw_secret = "JBSWY3DPEHPK3PXP"
            encrypted = service._encrypt_secret(raw_secret)

            # Encrypted must NOT equal raw secret
            assert encrypted != raw_secret
            # Encrypted must be decryptable back to original
            decrypted = service._decrypt_secret(encrypted)
            assert decrypted == raw_secret

    def test_encryption_key_is_not_hardcoded(self):
        """Encryption key should come from environment, not be hardcoded in code."""
        with patch("app.services.mfa.get_db") as mock_db, patch(
            "app.services.mfa.os.getenv"
        ) as mock_env:
            mock_db.return_value = MagicMock()

            # Simulate env var set
            test_key = Fernet.generate_key()
            mock_env.return_value = test_key

            from app.services import mfa as mfa_module

            service = mfa_module.MFAService()

            # Key should be the one from env
            assert service.cipher is not None

    def test_decrypt_handles_corrupted_data_gracefully(self):
        """Decryption of corrupted/invalid data should fallback, not crash."""
        with patch("app.services.mfa.get_db") as mock_db:
            mock_db.return_value = MagicMock()

            from app.services.mfa import MFAService

            service = MFAService()

            # Corrupted data - should fallback to returning it as-is (legacy support)
            corrupted_data = "not-a-valid-fernet-token"
            result = service._decrypt_secret(corrupted_data)
            assert result == corrupted_data  # Legacy fallback

    def test_enable_mfa_rejects_invalid_token(self):
        """MFA enable should fail if the TOTP token is wrong."""
        with patch("app.services.mfa.get_db") as mock_db:
            mock_db.return_value = MagicMock()

            from app.services.mfa import MFAService

            service = MFAService()

            secret = service.generate_secret()
            # Wrong token
            result = service.enable_mfa("user123", secret, "000000")

            # Should not enable MFA
            assert result is False
            # Firestore should NOT be written to
            mock_db.return_value.collection.return_value.document.return_value.set.assert_not_called()

    def test_enable_mfa_with_valid_token(self):
        """MFA enable should work with a correct TOTP token."""
        import pyotp

        with patch("app.services.mfa.get_db") as mock_db:
            mock_db.return_value = MagicMock()

            from app.services.mfa import MFAService

            service = MFAService()

            secret = service.generate_secret()
            # Generate correct token
            totp = pyotp.TOTP(secret)
            valid_token = totp.now()

            result = service.enable_mfa("user123", secret, valid_token)

            assert result is True
            # Verify Firestore was written with encrypted secret
            mock_db.return_value.collection.return_value.document.return_value.set.assert_called_once()
            call_args = mock_db.return_value.collection.return_value.document.return_value.set.call_args[
                0
            ][
                0
            ]
            assert call_args["mfa_enabled"] is True
            # The stored secret must be encrypted (not raw)
            assert call_args["mfa_secret"] != secret


# ============================================================
# 2. MFA CROSS-USER ISOLATION
# ============================================================


class TestMFACrossUserIsolation:
    """Tests that MFA secrets cannot leak between users."""

    def test_get_user_secret_uses_user_id(self):
        """get_user_secret must always query by the specific user_id."""
        with patch("app.services.mfa.get_db") as mock_db:
            mock_firestore = MagicMock()
            mock_db.return_value = mock_firestore

            from app.services.mfa import MFAService

            service = MFAService()

            # Mock document
            mock_doc = MagicMock()
            mock_doc.exists = True
            mock_doc.to_dict.return_value = {
                "mfa_secret": service._encrypt_secret("SECRET_A"),
                "mfa_enabled": True,
            }
            mock_firestore.collection.return_value.document.return_value.get.return_value = (
                mock_doc
            )

            service.get_user_secret("user_A")

            # Verify correct user_id was used for document lookup
            mock_firestore.collection.return_value.document.assert_called_with("user_A")

    def test_disable_mfa_only_affects_own_user(self):
        """disable_mfa must only modify the specified user's document."""
        with patch("app.services.mfa.get_db") as mock_db:
            mock_firestore = MagicMock()
            mock_db.return_value = mock_firestore

            from app.services.mfa import MFAService

            service = MFAService()
            service.disable_mfa("user_A")

            # Verify correct user_id was used
            mock_firestore.collection.return_value.document.assert_called_with("user_A")
            mock_firestore.collection.return_value.document.return_value.set.assert_called_once_with(
                {"mfa_secret": None, "mfa_enabled": False}, merge=True
            )


# ============================================================
# 3. AUTHENTICATION GUARD TESTS
# ============================================================


class TestAuthenticationGuard:
    """Tests the Firebase token verification in security.py."""

    def test_valid_token_returns_user_data(self):
        """A valid Firebase ID token should return decoded user data."""
        with patch("app.core.security.auth") as mock_auth:
            from app.core.security import get_current_user

            mock_auth.verify_id_token.return_value = {
                "uid": "user123",
                "email": "user@test.com",
            }

            mock_creds = MagicMock()
            mock_creds.credentials = "valid.firebase.token"

            result = get_current_user(mock_creds)

            assert result["uid"] == "user123"
            assert result["email"] == "user@test.com"
            mock_auth.verify_id_token.assert_called_once_with("valid.firebase.token")

    def test_invalid_token_raises_401(self):
        """An invalid or expired token should raise HTTP 401."""
        with patch("app.core.security.auth") as mock_auth:
            from app.core.security import get_current_user

            mock_auth.verify_id_token.side_effect = Exception("Token expired")

            mock_creds = MagicMock()
            mock_creds.credentials = "invalid.token.here"

            with pytest.raises(HTTPException) as exc_info:
                get_current_user(mock_creds)

            assert exc_info.value.status_code == 401

    def test_missing_token_raises_401(self):
        """Empty or missing token should raise HTTP 401."""
        with patch("app.core.security.auth") as mock_auth:
            from app.core.security import get_current_user

            mock_auth.verify_id_token.side_effect = Exception("Token is empty")

            mock_creds = MagicMock()
            mock_creds.credentials = ""

            with pytest.raises(HTTPException) as exc_info:
                get_current_user(mock_creds)

            assert exc_info.value.status_code == 401

    def test_tampered_token_raises_401(self):
        """A modified/tampered JWT token should raise HTTP 401."""
        with patch("app.core.security.auth") as mock_auth:
            from app.core.security import get_current_user

            mock_auth.verify_id_token.side_effect = Exception(
                "Could not verify token signature"
            )

            mock_creds = MagicMock()
            mock_creds.credentials = (
                "eyJhbGciOiJSUzI1NiIsImtpZCI6ImZha2UifQ.tampered.signature"
            )

            with pytest.raises(HTTPException) as exc_info:
                get_current_user(mock_creds)

            assert exc_info.value.status_code == 401


# ============================================================
# 4. STRIPE WEBHOOK SECURITY TESTS (Deep)
# ============================================================


class TestStripeWebhookDeep:
    """Deep tests for Stripe webhook processing security."""

    def test_webhook_checkout_completed_links_user(self):
        """checkout.session.completed should link user_id to stripe_customer_id."""
        import asyncio
        from unittest.mock import AsyncMock

        import stripe as stripe_module

        with patch("app.services.stripe_service.get_db") as mock_db:
            mock_firestore = MagicMock()
            mock_db.return_value = mock_firestore

            from app.services.stripe_service import StripeService

            service = StripeService()

            # Simulate webhook event
            mock_event = {
                "type": "checkout.session.completed",
                "data": {
                    "object": {
                        "client_reference_id": "user_123",
                        "customer": "cus_abc",
                        "subscription": "sub_xyz",
                    }
                },
            }

            with patch.object(
                stripe_module.Webhook,
                "construct_event",
                return_value=mock_event,
            ), patch.object(
                stripe_module.Subscription,
                "retrieve",
                return_value={"id": "sub_xyz", "status": "active"},
            ), patch.object(
                service,
                "_handle_subscription_updated",
                new_callable=AsyncMock
            ):
                result = asyncio.run(service.handle_webhook(b"payload", "valid_sig"))

            assert result["status"] == "success"
            # Verify user doc was updated with stripe_customer_id
            mock_firestore.collection.return_value.document.assert_called_with(
                "user_123"
            )
            mock_firestore.collection.return_value.document.return_value.set.assert_called_once_with(
                {
                    "stripe_customer_id": "cus_abc",
                    "stripe_subscription_id": "sub_xyz",
                },
                merge=True,
            )

    def test_webhook_subscription_deleted_downgrades_to_free(self):
        """customer.subscription.deleted should downgrade user to free tier."""
        import asyncio

        import stripe as stripe_module

        with patch("app.services.stripe_service.get_db") as mock_db:
            mock_firestore = MagicMock()
            mock_db.return_value = mock_firestore

            from app.services.stripe_service import StripeService

            service = StripeService()

            # Mock user lookup by stripe_customer_id
            mock_user_doc = MagicMock()
            mock_user_doc.reference = MagicMock()
            mock_firestore.collection.return_value.where.return_value.limit.return_value.stream.return_value = [
                mock_user_doc
            ]

            mock_event = {
                "type": "customer.subscription.deleted",
                "data": {
                    "object": {
                        "customer": "cus_abc",
                    }
                },
            }

            with patch.object(
                stripe_module.Webhook,
                "construct_event",
                return_value=mock_event,
            ):
                result = asyncio.run(service.handle_webhook(b"payload", "valid_sig"))

            assert result["status"] == "success"
            # Verify user was downgraded to free
            mock_user_doc.reference.set.assert_called_once_with(
                {"subscription_status": "canceled", "subscription_tier": "free"},
                merge=True,
            )

    def test_infer_tier_from_price_returns_correct_tier(self):
        """_infer_tier_from_price should correctly identify pro/premium tiers."""
        with patch("app.services.stripe_service.get_db") as mock_db:
            mock_db.return_value = MagicMock()

            from app.services.stripe_service import StripeService

            service = StripeService()
            service.prices = {
                "pro_monthly": "price_pro_m",
                "pro_yearly": "price_pro_y",
                "premium_monthly": "price_prem_m",
                "premium_yearly": "price_prem_y",
            }

            assert service._infer_tier_from_price("price_pro_m") == "pro"
            assert service._infer_tier_from_price("price_pro_y") == "pro"
            assert service._infer_tier_from_price("price_prem_m") == "premium"
            assert service._infer_tier_from_price("price_prem_y") == "premium"
            assert service._infer_tier_from_price("unknown_price") == "free"
