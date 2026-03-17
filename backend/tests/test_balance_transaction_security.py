"""
Security Tests: Transaction & Balance Manipulation
Tests that account balances cannot be manipulated and
transactions enforce proper user ownership.
"""

from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException


class TestBalanceUpdateSecurity:
    """Tests that _update_account_balance enforces user ownership."""

    def test_balance_update_checks_user_ownership(self):
        """Balance update must verify user_id matches account owner."""
        with patch("app.services.transaction.get_db") as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = mock_db

            # Account belongs to user_A
            mock_acc_doc = MagicMock()
            mock_acc_doc.exists = True
            mock_acc_doc.to_dict.return_value = {
                "user_id": "user_A",
                "balance": 1000.0,
            }
            mock_db.collection.return_value.document.return_value.get.return_value = (
                mock_acc_doc
            )

            from app.services.transaction import _update_account_balance

            # user_B tries to update user_A's account
            _update_account_balance(mock_db, "acc_123", 500.0, "expense", "user_B")

            # Should NOT update because user_id doesn't match
            mock_db.collection.return_value.document.return_value.update.assert_not_called()

    def test_balance_update_works_for_correct_user(self):
        """Balance update should work when user_id matches."""
        with patch("app.services.transaction.get_db") as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = mock_db

            mock_acc_doc = MagicMock()
            mock_acc_doc.exists = True
            mock_acc_doc.to_dict.return_value = {
                "user_id": "user_A",
                "balance": 1000.0,
            }
            mock_db.collection.return_value.document.return_value.get.return_value = (
                mock_acc_doc
            )

            from app.services.transaction import _update_account_balance

            _update_account_balance(mock_db, "acc_123", 500.0, "expense", "user_A")

            # Should update: 1000 - 500 = 500
            mock_db.collection.return_value.document.return_value.update.assert_called_once_with(
                {"balance": 500.0}
            )

    def test_expense_decreases_balance(self):
        """An expense should subtract from account balance."""
        with patch("app.services.transaction.get_db") as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = mock_db

            mock_acc_doc = MagicMock()
            mock_acc_doc.exists = True
            mock_acc_doc.to_dict.return_value = {
                "user_id": "user_A",
                "balance": 1000.0,
            }
            mock_db.collection.return_value.document.return_value.get.return_value = (
                mock_acc_doc
            )

            from app.services.transaction import _update_account_balance

            _update_account_balance(mock_db, "acc_123", 300.0, "expense", "user_A")

            mock_db.collection.return_value.document.return_value.update.assert_called_once_with(
                {"balance": 700.0}
            )

    def test_income_increases_balance(self):
        """An income should add to account balance."""
        with patch("app.services.transaction.get_db") as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = mock_db

            mock_acc_doc = MagicMock()
            mock_acc_doc.exists = True
            mock_acc_doc.to_dict.return_value = {
                "user_id": "user_A",
                "balance": 1000.0,
            }
            mock_db.collection.return_value.document.return_value.get.return_value = (
                mock_acc_doc
            )

            from app.services.transaction import _update_account_balance

            _update_account_balance(mock_db, "acc_123", 500.0, "income", "user_A")

            mock_db.collection.return_value.document.return_value.update.assert_called_once_with(
                {"balance": 1500.0}
            )

    def test_revert_expense_restores_balance(self):
        """Reverting an expense should add amount back."""
        with patch("app.services.transaction.get_db") as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = mock_db

            mock_acc_doc = MagicMock()
            mock_acc_doc.exists = True
            mock_acc_doc.to_dict.return_value = {
                "user_id": "user_A",
                "balance": 700.0,
            }
            mock_db.collection.return_value.document.return_value.get.return_value = (
                mock_acc_doc
            )

            from app.services.transaction import _update_account_balance

            _update_account_balance(
                mock_db, "acc_123", 300.0, "expense", "user_A", revert=True
            )

            mock_db.collection.return_value.document.return_value.update.assert_called_once_with(
                {"balance": 1000.0}
            )

    def test_transfer_decreases_source_balance(self):
        """A transfer should subtract from source account."""
        with patch("app.services.transaction.get_db") as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = mock_db

            mock_acc_doc = MagicMock()
            mock_acc_doc.exists = True
            mock_acc_doc.to_dict.return_value = {
                "user_id": "user_A",
                "balance": 2000.0,
            }
            mock_db.collection.return_value.document.return_value.get.return_value = (
                mock_acc_doc
            )

            from app.services.transaction import _update_account_balance

            _update_account_balance(mock_db, "acc_src", 750.0, "transfer", "user_A")

            mock_db.collection.return_value.document.return_value.update.assert_called_once_with(
                {"balance": 1250.0}
            )

    def test_null_account_id_silently_skips(self):
        """If account_id is None/empty, skip balance update."""
        with patch("app.services.transaction.get_db") as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = mock_db

            from app.services.transaction import _update_account_balance

            _update_account_balance(mock_db, None, 100.0, "expense", "user_A")
            _update_account_balance(mock_db, "", 100.0, "expense", "user_A")

            # DB should not be queried at all
            mock_db.collection.return_value.document.assert_not_called()


class TestTransactionDeletion:
    """Tests that transaction deletion enforces user ownership."""

    def test_delete_transaction_wrong_user_fails(self):
        """Deleting another user's transaction must fail."""
        with patch("app.services.transaction.get_db") as mock_get_db, patch(
            "app.services.transaction.analysis_service"
        ):
            mock_db = MagicMock()
            mock_get_db.return_value = mock_db

            mock_doc = MagicMock()
            mock_doc.exists = True
            mock_doc.to_dict.return_value = {
                "user_id": "user_A",
                "amount": 100,
                "type": "expense",
                "account_id": "acc1",
            }
            mock_db.collection.return_value.document.return_value.get.return_value = (
                mock_doc
            )

            from app.services.transaction import delete_transaction

            with pytest.raises(HTTPException) as exc_info:
                delete_transaction("tx_123", "user_B")

            assert exc_info.value.status_code in [403, 404]
