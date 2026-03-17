"""
Security Tests: Recurrence & Debt cross-user isolation.
Tests that recurrence and debt data cannot leak between users.
"""

from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException


class TestRecurrenceSecurity:
    """Tests that recurrence data is properly isolated per user."""

    def test_get_recurrence_rejects_wrong_user(self):
        """Accessing another user's recurrence must return 404."""
        with patch("app.services.recurrence.get_db") as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = mock_db

            # Mock recurrence belongs to user_A
            mock_doc = MagicMock()
            mock_doc.exists = True
            mock_doc.to_dict.return_value = {
                "user_id": "user_A",
                "description": "Rent",
                "amount": 1000.0,
            }
            mock_db.collection.return_value.document.return_value.get.return_value = (
                mock_doc
            )

            from app.services.recurrence import get_recurrence

            # user_B tries to access user_A's recurrence
            result = get_recurrence("rec_123", "user_B")
            assert result is None

    def test_list_recurrences_filters_by_user(self):
        """list_recurrences must only return current user's docs."""
        with patch("app.services.recurrence.get_db") as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = mock_db

            from app.services.recurrence import list_recurrences

            list_recurrences("user_A")

            # Verify the where clause uses user_id filter
            mock_db.collection.return_value.where.assert_called()
            call_args = mock_db.collection.return_value.where.call_args
            # Should filter by user_id == user_A
            args = call_args[0] if call_args[0] else ()
            kwargs = call_args[1] if call_args[1] else {}

            # Check positional or keyword arguments for user_id filter
            if args:
                assert "user_id" in str(args)
            elif kwargs:
                assert "user_id" in str(
                    kwargs.get("field_path", "")
                ) or "user_id" in str(kwargs)

    def test_cancel_recurrence_rejects_wrong_user(self):
        """Canceling another user's recurrence must fail."""
        with patch("app.services.recurrence.get_db") as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = mock_db

            mock_doc = MagicMock()
            mock_doc.exists = True
            mock_doc.to_dict.return_value = {
                "user_id": "user_A",
                "description": "Rent",
                "amount": 1000.0,
            }
            mock_db.collection.return_value.document.return_value.get.return_value = (
                mock_doc
            )

            from app.services.recurrence import cancel_recurrence

            with pytest.raises(HTTPException) as exc_info:
                cancel_recurrence("rec_123", "user_B")

            assert exc_info.value.status_code in [403, 404]

    def test_update_recurrence_rejects_wrong_user(self):
        """Updating another user's recurrence must fail."""
        with patch("app.services.recurrence.get_db") as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = mock_db

            mock_doc = MagicMock()
            mock_doc.exists = True
            mock_doc.to_dict.return_value = {
                "user_id": "user_A",
                "description": "Rent",
                "amount": 1000.0,
            }
            mock_db.collection.return_value.document.return_value.get.return_value = (
                mock_doc
            )

            from app.schemas.recurrence import RecurrenceUpdate
            from app.services.recurrence import update_recurrence

            update_data = RecurrenceUpdate(amount=9999.99)

            with pytest.raises(HTTPException) as exc_info:
                update_recurrence("rec_123", update_data, "user_B")

            assert exc_info.value.status_code in [403, 404]


class TestDebtServiceSecurity:
    """Tests debt data isolation and tier enforcement."""

    def test_get_debt_rejects_wrong_user(self):
        """Accessing another user's debt must return 404."""
        with patch("app.services.debt_service.get_db") as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = mock_db

            mock_doc = MagicMock()
            mock_doc.exists = True
            mock_doc.to_dict.return_value = {
                "user_id": "user_A",
                "name": "Credit Card",
                "total_amount": 5000,
            }
            mock_db.collection.return_value.document.return_value.get.return_value = (
                mock_doc
            )

            from app.services.debt_service import get_debt

            with pytest.raises(HTTPException) as exc_info:
                get_debt("user_B", "debt_123")

            assert exc_info.value.status_code == 404

    def test_delete_debt_rejects_wrong_user(self):
        """Deleting another user's debt must fail."""
        with patch("app.services.debt_service.get_db") as mock_get_db, patch(
            "app.services.debt_service.get_preferences"
        ) as mock_prefs:
            mock_db = MagicMock()
            mock_get_db.return_value = mock_db
            mock_pref = MagicMock()
            mock_pref.subscription_tier = "pro"
            mock_prefs.return_value = mock_pref

            mock_doc = MagicMock()
            mock_doc.exists = True
            mock_doc.to_dict.return_value = {
                "user_id": "user_A",
                "name": "Loan",
            }
            mock_db.collection.return_value.document.return_value.get.return_value = (
                mock_doc
            )

            from app.services.debt_service import delete_debt

            with pytest.raises(HTTPException) as exc_info:
                delete_debt("user_B", "debt_123")

            assert exc_info.value.status_code == 404

    def test_tier_check_blocks_free_users(self):
        """Free users must be blocked from debt operations."""
        with patch("app.services.debt_service.get_preferences") as mock_prefs:
            mock_pref = MagicMock()
            mock_pref.subscription_tier = "free"
            mock_prefs.return_value = mock_pref

            from app.services.debt_service import check_tier_eligibility

            with pytest.raises(HTTPException) as exc_info:
                check_tier_eligibility("free_user")

            assert exc_info.value.status_code == 403

    def test_tier_check_allows_pro_users(self):
        """Pro users must be allowed debt operations."""
        with patch("app.services.debt_service.get_preferences") as mock_prefs:
            mock_pref = MagicMock()
            mock_pref.subscription_tier = "pro"
            mock_prefs.return_value = mock_pref

            from app.services.debt_service import check_tier_eligibility

            result = check_tier_eligibility("pro_user")
            assert result == "pro"

    def test_tier_check_allows_premium_users(self):
        """Premium users must be allowed debt operations."""
        with patch("app.services.debt_service.get_preferences") as mock_prefs:
            mock_pref = MagicMock()
            mock_pref.subscription_tier = "premium"
            mock_prefs.return_value = mock_pref

            from app.services.debt_service import check_tier_eligibility

            result = check_tier_eligibility("premium_user")
            assert result == "premium"


class TestInvoiceServiceSecurity:
    """Tests invoice service security and data isolation."""

    def test_pay_invoice_requires_source_account(self):
        """Invoice payment without source_account_id must fail."""
        with patch("app.services.invoice.account_service"), patch(
            "app.services.invoice.transaction_service"
        ):

            from app.services.invoice import pay_invoice

            invoice_data = {
                "credit_card_id": "card_1",
                "amount": 500.0,
                "source_account_id": None,  # Missing!
                "month": 3,
                "year": 2026,
            }

            with pytest.raises(HTTPException) as exc_info:
                pay_invoice("user_123", invoice_data)

            assert exc_info.value.status_code == 400
            assert "obrigatória" in exc_info.value.detail

    def test_pay_invoice_prevents_duplicate_payment(self):
        """Double-paying the same invoice must be blocked."""
        with patch("app.services.invoice.account_service"), patch(
            "app.services.invoice.transaction_service"
        ) as mock_tx:

            # Simulate existing payment with the REF key
            existing_tx = MagicMock()
            existing_tx.type = "transfer"
            existing_tx.description = "Pagamento fatura | REF:card_1:3:2026"
            mock_tx.list_transactions.return_value = [existing_tx]

            from app.services.invoice import pay_invoice

            invoice_data = {
                "credit_card_id": "card_1",
                "amount": 500.0,
                "source_account_id": "acc_1",
                "month": 3,
                "year": 2026,
            }

            with pytest.raises(HTTPException) as exc_info:
                pay_invoice("user_123", invoice_data)

            assert exc_info.value.status_code == 400
            assert "já foi paga" in exc_info.value.detail
