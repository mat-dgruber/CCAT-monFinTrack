"""
Security Tests: XSS Prevention & Input Sanitization
Tests that user input is properly sanitized to prevent XSS attacks.
"""

from unittest.mock import MagicMock, patch

import pytest


class TestXSSPrevention:
    """Tests that HTML/script injection is stripped from user input."""

    def test_sanitize_html_strips_script_tags(self):
        """Script tags must be completely removed."""
        from app.core.validators import sanitize_html

        malicious = '<script>alert("XSS")</script>Hello'
        result = sanitize_html(malicious)
        assert "<script>" not in result

    def test_sanitize_html_strips_event_handlers(self):
        """Event handlers like onerror must be removed."""
        from app.core.validators import sanitize_html

        malicious = "<img src=x onerror=alert(1)>"
        result = sanitize_html(malicious)
        assert "onerror" not in result
        assert "<img" not in result

    def test_sanitize_html_strips_iframe(self):
        """Iframe injection must be blocked."""
        from app.core.validators import sanitize_html

        malicious = '<iframe src="http://evil.com"></iframe>Normal text'
        result = sanitize_html(malicious)
        assert "<iframe" not in result
        assert "Normal text" in result

    def test_sanitize_html_preserves_clean_text(self):
        """Clean text without HTML should be untouched."""
        from app.core.validators import sanitize_html

        clean = "Compras no supermercado"
        result = sanitize_html(clean)
        assert result == clean

    def test_sanitize_html_handles_none_gracefully(self):
        """Non-string values should be returned as-is."""
        from app.core.validators import sanitize_html

        assert sanitize_html(123) == 123
        assert sanitize_html(None) is None

    def test_category_name_is_sanitized(self):
        """Category name field should use sanitize_html validator."""
        from app.schemas.category import CategoryCreate

        cat = CategoryCreate(
            name="<script>alert(1)</script>Groceries",
            icon="pi pi-tag",
            color="#3b82f6",
        )
        assert "<script>" not in cat.name
        assert "Groceries" in cat.name

    def test_sanitize_html_strips_nested_tags(self):
        """Nested and obfuscated tags should be stripped."""
        from app.core.validators import sanitize_html

        malicious = '<<script>script>alert("XSS")<</script>/script>'
        result = sanitize_html(malicious)
        assert "<script>" not in result
        assert "</script>" not in result


class TestInputValidation:
    """Tests that Pydantic schemas enforce validation rules."""

    def test_category_name_min_length(self):
        """Category name must be at least 2 characters."""
        from app.schemas.category import CategoryCreate
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            CategoryCreate(name="A", icon="pi", color="#000")

    def test_transaction_amount_positive(self):
        """Transaction amount must be strictly greater than 0."""
        from app.schemas.transaction import TransactionCreate
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            TransactionCreate(
                title="Compras",
                amount=-100,
                type="expense",
                category_id="cat1",
                account_id="acc1",
                payment_method="CASH",
            )

    def test_budget_amount_schema_validation(self):
        """Budget amount should be validated by schema."""
        from app.schemas.budget import BudgetCreate

        budget = BudgetCreate(category_id="cat1", amount=500.0)
        assert budget.amount == 500.0
        assert budget.category_id == "cat1"
