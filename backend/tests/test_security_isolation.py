"""
Security Tests: Cross-User Data Isolation & Subscription Protection
Ensures that no user can access, modify, or leak data from another user's records.
Focuses on account, transaction, subscription tier, and Stripe data isolation.
"""

from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
from app.schemas.account import Account, AccountCreate, AccountType
from app.schemas.category import Category
from app.services import account as account_service
from app.services import category as category_service
from app.services import transaction as transaction_service
from fastapi import HTTPException

# ============================================================
# FIXTURES
# ============================================================

USER_A = "user_alpha"
USER_B = "user_beta"


@pytest.fixture
def mock_db():
    with patch("app.services.account.get_db") as mock:
        mock_firestore_client = MagicMock()
        mock.return_value = mock_firestore_client
        yield mock_firestore_client


@pytest.fixture
def mock_db_category():
    with patch("app.services.category.get_db") as mock:
        mock_firestore_client = MagicMock()
        mock.return_value = mock_firestore_client
        yield mock_firestore_client


@pytest.fixture
def mock_db_transaction():
    with patch("app.services.transaction.get_db") as mock:
        mock_firestore_client = MagicMock()
        mock.return_value = mock_firestore_client
        yield mock_firestore_client


# ============================================================
# 1. ACCOUNT ISOLATION TESTS
# ============================================================


class TestAccountIsolation:
    """Tests that accounts are strictly isolated between users."""

    def test_get_account_rejects_foreign_user(self, mock_db):
        """User B cannot read User A's account via get_account."""
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.id = "acc_user_a"
        mock_doc.to_dict.return_value = {
            "name": "User A Savings",
            "type": "savings",
            "balance": 50000.0,
            "user_id": USER_A,
            "icon": "",
            "color": "",
        }
        mock_db.collection.return_value.document.return_value.get.return_value = (
            mock_doc
        )

        # User B tries to access User A's account
        result = account_service.get_account("acc_user_a", USER_B)
        assert result is None, "User B should NOT be able to read User A's account"

    def test_get_account_allows_owner(self, mock_db):
        """Owner can read their own account."""
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.id = "acc_user_a"
        mock_doc.to_dict.return_value = {
            "name": "User A Savings",
            "type": "savings",
            "balance": 50000.0,
            "user_id": USER_A,
            "icon": "",
            "color": "",
        }
        mock_db.collection.return_value.document.return_value.get.return_value = (
            mock_doc
        )

        result = account_service.get_account("acc_user_a", USER_A)
        assert result is not None
        assert result.name == "User A Savings"

    def test_update_account_rejects_foreign_user(self, mock_db):
        """User B cannot update User A's account."""
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {"user_id": USER_A}
        mock_db.collection.return_value.document.return_value.get.return_value = (
            mock_doc
        )

        update_data = AccountCreate(
            name="Hacked Name",
            type=AccountType.CHECKING,
            balance=999999.0,
            icon="",
            color="",
        )

        with pytest.raises(HTTPException) as exc_info:
            account_service.update_account("acc_user_a", update_data, USER_B)

        assert exc_info.value.status_code == 404

    def test_delete_account_rejects_foreign_user(self, mock_db):
        """User B cannot delete User A's account."""
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {"user_id": USER_A}
        mock_db.collection.return_value.document.return_value.get.return_value = (
            mock_doc
        )

        with pytest.raises(HTTPException) as exc_info:
            account_service.delete_account("acc_user_a", USER_B)

        assert exc_info.value.status_code == 404
        mock_db.collection.return_value.document.return_value.delete.assert_not_called()

    def test_list_accounts_filters_by_user(self, mock_db):
        """list_accounts should ONLY return accounts belonging to the requesting user."""
        mock_db.collection.return_value.where.return_value.stream.return_value = []

        account_service.list_accounts(USER_A)

        # Verify the WHERE filter was applied with the correct user_id
        mock_db.collection.return_value.where.assert_called_with(
            "user_id", "==", USER_A
        )

    def test_create_account_stamps_user_id(self, mock_db):
        """Created accounts must always have user_id stamped by the server."""
        mock_doc_ref = MagicMock()
        mock_doc_ref.id = "new_acc"
        mock_db.collection.return_value.add.return_value = (None, mock_doc_ref)

        account_in = AccountCreate(
            name="Test", type=AccountType.CHECKING, balance=0, icon="", color=""
        )

        result = account_service.create_account(account_in, USER_A)

        # Verify user_id was force-set (not from client input)
        call_data = mock_db.collection.return_value.add.call_args[0][0]
        assert call_data["user_id"] == USER_A
        assert result.user_id == USER_A


# ============================================================
# 2. CATEGORY ISOLATION TESTS
# ============================================================


class TestCategoryIsolation:
    """Tests that categories are strictly isolated between users."""

    def test_get_category_rejects_foreign_user(self, mock_db_category):
        """User B cannot read User A's category."""
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.id = "cat_user_a"
        mock_doc.to_dict.return_value = {
            "name": "User A Secret Category",
            "type": "expense",
            "icon": "",
            "color": "",
            "is_custom": True,
            "user_id": USER_A,
        }
        mock_db_category.collection.return_value.document.return_value.get.return_value = (
            mock_doc
        )

        result = category_service.get_category("cat_user_a", USER_B)
        assert result is None, "User B should NOT see User A's category"

    def test_update_category_rejects_foreign_user(self, mock_db_category):
        """User B cannot update User A's category."""
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {"user_id": USER_A}
        mock_db_category.collection.return_value.document.return_value.get.return_value = (
            mock_doc
        )

        from app.schemas.category import CategoryCreate

        update_data = CategoryCreate(
            name="Hacked", type="expense", icon="", color="", is_custom=True
        )

        with pytest.raises(HTTPException) as exc_info:
            category_service.update_category("cat_user_a", update_data, USER_B)

        assert exc_info.value.status_code == 404

    def test_delete_category_rejects_foreign_user(self, mock_db_category):
        """User B cannot delete User A's category."""
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {"user_id": USER_A}
        mock_db_category.collection.return_value.document.return_value.get.return_value = (
            mock_doc
        )

        with pytest.raises(HTTPException) as exc_info:
            category_service.delete_category("cat_user_a", USER_B)

        assert exc_info.value.status_code == 404


# ============================================================
# 3. TRANSACTION ISOLATION TESTS
# ============================================================


class TestTransactionIsolation:
    """Tests that transactions are strictly isolated between users."""

    def test_delete_transaction_rejects_foreign_user(self, mock_db_transaction):
        """User B cannot delete User A's transaction."""
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {
            "user_id": USER_A,
            "amount": 100.0,
            "type": "expense",
            "account_id": "acc1",
            "status": "paid",
        }
        mock_db_transaction.collection.return_value.document.return_value.get.return_value = (
            mock_doc
        )

        with pytest.raises(HTTPException) as exc_info:
            transaction_service.delete_transaction("trans_user_a", USER_B)

        assert exc_info.value.status_code == 404
        mock_db_transaction.collection.return_value.document.return_value.delete.assert_not_called()

    def test_update_transaction_rejects_foreign_user(self, mock_db_transaction):
        """User B cannot update User A's transaction."""
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {
            "user_id": USER_A,
            "amount": 100.0,
            "type": "expense",
            "account_id": "acc1",
            "status": "paid",
            "category_id": "cat1",
            "date": datetime(2024, 1, 1),
            "title": "Test",
        }
        mock_db_transaction.collection.return_value.document.return_value.get.return_value = (
            mock_doc
        )

        from app.schemas.transaction import TransactionUpdate

        update_data = TransactionUpdate(title="Hacked Title", amount=0.01)

        with pytest.raises(HTTPException) as exc_info:
            transaction_service.update_transaction("trans_user_a", update_data, USER_B)

        assert exc_info.value.status_code == 404

    def test_list_transactions_filters_by_user(self, mock_db_transaction):
        """list_transactions only queries for the authenticated user's data."""
        with patch("app.services.transaction.category_service") as cat_mock, patch(
            "app.services.transaction.account_service"
        ) as acc_mock:
            cat_mock.list_all_categories_flat.return_value = []
            acc_mock.list_accounts.return_value = []

            # Mock query chain
            mock_query = MagicMock()
            mock_query.where.return_value = mock_query
            mock_query.stream.return_value = iter([])
            mock_db_transaction.collection.return_value.where.return_value = mock_query

            transaction_service.list_transactions(USER_A)

            # Verify user_id filter applied to Firestore query
            mock_db_transaction.collection.return_value.where.assert_called_with(
                "user_id", "==", USER_A
            )


# ============================================================
# 4. SUBSCRIPTION / STRIPE SECURITY TESTS
# ============================================================


class TestSubscriptionSecurity:
    """Tests that subscription data and Stripe IDs cannot leak between users."""

    def test_stripe_service_webhook_rejects_invalid_signature(self):
        """Webhook must reject requests with invalid Stripe signature."""
        import stripe as stripe_module

        with patch("app.services.stripe_service.get_db") as mock_db:
            mock_db.return_value = MagicMock()

            from app.services.stripe_service import StripeService

            service = StripeService()

            # Patch construct_event to raise SignatureVerificationError
            with patch.object(
                stripe_module.Webhook,
                "construct_event",
                side_effect=stripe_module.error.SignatureVerificationError(
                    "Invalid signature", "sig"
                ),
            ):
                with pytest.raises(HTTPException) as exc_info:
                    import asyncio

                    asyncio.run(service.handle_webhook(b"payload", "invalid_sig"))

                assert exc_info.value.status_code == 400

    def test_stripe_checkout_uses_authenticated_user_id(self):
        """Checkout session always uses server-side authenticated user_id, never client-provided."""
        import stripe as stripe_module

        with patch("app.services.stripe_service.get_db") as mock_db:
            mock_db_client = MagicMock()
            mock_db.return_value = mock_db_client

            from app.services.stripe_service import StripeService

            service = StripeService()

            # Mock user doc
            mock_user_doc = MagicMock()
            mock_user_doc.exists = True
            mock_user_doc.to_dict.return_value = {"stripe_customer_id": "cus_existing"}
            mock_db_client.collection.return_value.document.return_value.get.return_value = (
                mock_user_doc
            )

            # Mock Stripe checkout
            with patch.object(
                stripe_module.checkout.Session,
                "create",
                return_value={
                    "id": "cs_test",
                    "url": "https://checkout.stripe.com/test",
                },
            ) as mock_create:
                service.create_checkout_session(
                    user_id=USER_A,
                    plan="pro_monthly",
                    success_url="https://app.test/success",
                    cancel_url="https://app.test/cancel",
                )

                # Verify client_reference_id is the authenticated user_id
                call_kwargs = mock_create.call_args
                assert call_kwargs.kwargs.get("client_reference_id") == USER_A

    def test_portal_session_rejects_user_without_stripe_customer(self):
        """Portal session should fail if user has no stripe_customer_id."""
        with patch("app.services.stripe_service.get_db") as mock_db:
            mock_db_client = MagicMock()
            mock_db.return_value = mock_db_client

            from app.services.stripe_service import StripeService

            service = StripeService()

            # User exists but no stripe_customer_id
            mock_user_doc = MagicMock()
            mock_user_doc.exists = True
            mock_user_doc.to_dict.return_value = {}
            mock_db_client.collection.return_value.document.return_value.get.return_value = (
                mock_user_doc
            )

            with pytest.raises(HTTPException) as exc_info:
                service.create_portal_session(
                    user_id=USER_A, return_url="https://app.test"
                )

            assert exc_info.value.status_code == 400
            assert "Stripe Customer ID" in exc_info.value.detail

    def test_subscription_tier_check_enforced_on_premium_features(self):
        """Free users are blocked from premium-only features (document analysis)."""
        with patch("app.services.document_analysis.get_preferences") as pref_mock:
            from app.services.document_analysis import DocumentAnalysisService

            # Mock a free-tier user
            free_prefs = MagicMock()
            free_prefs.subscription_tier = "free"
            pref_mock.return_value = free_prefs

            # DocumentAnalysisService returns error dict (not raises) for free users
            result = DocumentAnalysisService.analyze_debt_document(
                user_id=USER_A, file_bytes=b"test", mime_type="application/pdf"
            )

            # Verify it blocked the free user
            assert "error" in result
            assert "Premium" in result["error"]


# ============================================================
# 5. BALANCE MANIPULATION SECURITY TESTS
# ============================================================


class TestBalanceManipulation:
    """Tests that account balance cannot be manipulated across users."""

    def test_balance_update_rejects_foreign_account(self, mock_db_transaction):
        """_update_account_balance should not modify accounts not owned by user."""
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {
            "user_id": USER_A,
            "balance": 1000.0,
        }
        mock_db_transaction.collection.return_value.document.return_value.get.return_value = (
            mock_doc
        )

        # User B tries to affect User A's account balance
        transaction_service._update_account_balance(
            mock_db_transaction,
            "acc_user_a",
            500.0,
            "expense",
            USER_B,
            revert=False,
        )

        # Balance should NOT be updated (user_id mismatch)
        mock_db_transaction.collection.return_value.document.return_value.update.assert_not_called()

    def test_balance_update_allows_owner(self, mock_db_transaction):
        """_update_account_balance should work for the legitimate owner."""
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {
            "user_id": USER_A,
            "balance": 1000.0,
        }
        mock_db_transaction.collection.return_value.document.return_value.get.return_value = (
            mock_doc
        )

        transaction_service._update_account_balance(
            mock_db_transaction,
            "acc_user_a",
            500.0,
            "expense",
            USER_A,
            revert=False,
        )

        # Balance should be updated
        mock_db_transaction.collection.return_value.document.return_value.update.assert_called_once()
        call_args = mock_db_transaction.collection.return_value.document.return_value.update.call_args[
            0
        ][
            0
        ]
        assert call_args["balance"] == 500.0  # 1000 - 500


# ============================================================
# 6. N+1 FIX REGRESSION TESTS
# ============================================================


class TestN1QueryFix:
    """Tests that the N+1 batch preloading fix works correctly."""

    def test_list_transactions_uses_batch_preloading(self, mock_db_transaction):
        """list_transactions should call list_all_categories_flat and list_accounts,
        NOT individual get_category/get_account per transaction."""
        with patch("app.services.transaction.category_service") as cat_mock, patch(
            "app.services.transaction.account_service"
        ) as acc_mock:
            # Setup batch preload returns
            cat_mock.list_all_categories_flat.return_value = [
                Category(
                    id="cat1",
                    name="Food",
                    type="expense",
                    icon="",
                    color="",
                    is_custom=False,
                    user_id=USER_A,
                )
            ]
            acc_mock.list_accounts.return_value = [
                Account(
                    id="acc1",
                    name="Bank",
                    type="checking",
                    balance=100,
                    user_id=USER_A,
                    icon="",
                    color="",
                )
            ]

            # Mock 3 transactions in the stream
            mock_transactions = []
            for i in range(3):
                mock_t = MagicMock()
                mock_t.id = f"t{i}"
                mock_t.to_dict.return_value = {
                    "user_id": USER_A,
                    "title": f"Transaction {i}",
                    "amount": 10.0 * (i + 1),
                    "type": "expense",
                    "category_id": "cat1",
                    "account_id": "acc1",
                    "date": datetime(2024, 1, i + 1),
                    "status": "paid",
                    "payment_method": "debit_card",
                    "description": "",
                }
                mock_transactions.append(mock_t)

            mock_query = MagicMock()
            mock_query.where.return_value = mock_query
            mock_query.stream.return_value = iter(mock_transactions)
            mock_db_transaction.collection.return_value.where.return_value = mock_query

            # Execute
            results = transaction_service.list_transactions(USER_A)

            # Verify batch preloading was used (1 call each)
            cat_mock.list_all_categories_flat.assert_called_once_with(USER_A)
            acc_mock.list_accounts.assert_called_once_with(USER_A)

            # Verify individual lookups were NOT called
            cat_mock.get_category.assert_not_called()
            acc_mock.get_account.assert_not_called()

            assert len(results) == 3

    def test_deleted_category_fallback(self, mock_db_transaction):
        """Transactions with missing categories should get 'Deleted' placeholder."""
        with patch("app.services.transaction.category_service") as cat_mock, patch(
            "app.services.transaction.account_service"
        ) as acc_mock:
            cat_mock.list_all_categories_flat.return_value = []  # No categories
            acc_mock.list_accounts.return_value = [
                Account(
                    id="acc1",
                    name="Bank",
                    type="checking",
                    balance=100,
                    user_id=USER_A,
                    icon="",
                    color="",
                )
            ]

            mock_t = MagicMock()
            mock_t.id = "t1"
            mock_t.to_dict.return_value = {
                "user_id": USER_A,
                "title": "Orphan Transaction",
                "amount": 50.0,
                "type": "expense",
                "category_id": "deleted_cat_id",
                "account_id": "acc1",
                "date": datetime(2024, 1, 1),
                "status": "paid",
                "payment_method": "debit_card",
                "description": "",
            }

            mock_query = MagicMock()
            mock_query.where.return_value = mock_query
            mock_query.stream.return_value = iter([mock_t])
            mock_db_transaction.collection.return_value.where.return_value = mock_query

            results = transaction_service.list_transactions(USER_A)

            assert len(results) == 1
            assert results[0].category.id == "deleted"
            assert results[0].category.name == "Deleted"
