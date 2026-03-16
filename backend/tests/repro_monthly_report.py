import os
import sys

# Adjust path to find app modules
sys.path.append(
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../../backend"))
)

import asyncio
from unittest.mock import MagicMock, patch

from app.schemas.category import Category, CategoryType
from app.services import ai_service


async def repro():
    print("Testing generate_monthly_report...")

    user_id = "test_user_id"
    month = 3
    year = 2026
    tier = "pro"

    # Mocking dependencies
    mock_tx = MagicMock()
    mock_tx.amount = 100.0
    mock_tx.type = "expense"
    mock_tx.category = Category(
        id="cat1",
        name="Alimentação",
        icon="pi pi-tag",
        color="#3b82f6",
        type=CategoryType.EXPENSE,
        user_id=user_id,
        is_custom=True,
    )

    mock_budget = {
        "id": "budget1",
        "category_id": "cat1",
        "category": mock_tx.category,
        "amount": 50.0,
        "spent": 100.0,
        "percentage": 200,
        "is_over_budget": True,
    }

    with patch(
        "app.services.transaction.list_transactions", return_value=[mock_tx]
    ), patch(
        "app.services.budget.list_budgets_with_progress", return_value=[mock_budget]
    ), patch(
        "app.services.ai_service.get_db"
    ) as mock_get_db, patch(
        "app.services.ai_service._call_with_retry"
    ) as mock_ai:

        # Mock Firestore
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        mock_db.collection.return_value.document.return_value.collection.return_value.document.return_value.get.return_value.exists = (
            False
        )

        # Mock AI Response
        mock_response = MagicMock()
        mock_response.text = "Relatório de IA gerado com sucesso!"
        mock_ai.return_value = mock_response

        try:
            result = ai_service.generate_monthly_report(user_id, month, year, tier)
            print(f"Result: {result}")
        except Exception as e:
            print(f"Error during execution: {e}")
            import traceback

            traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(repro())
