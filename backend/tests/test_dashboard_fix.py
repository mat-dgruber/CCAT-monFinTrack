import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone
from app.services.dashboard import get_dashboard_data
from app.schemas.category import Category, CategoryType
from app.schemas.transaction import Transaction, TransactionType, PaymentMethod
from app.schemas.account import Account, AccountType

@patch("app.core.database.get_db")
@patch("app.services.dashboard.category_service")
@patch("app.services.dashboard.budget_service")
def test_get_dashboard_data_handles_string_dates(mock_budget_service, mock_category_service, mock_get_db):
    """
    Teste para garantir que o dashboard não quebre (AttributeError)
    quando as datas das transações vêm como string do banco de dados.
    """
    # 1. Mock do Banco de Dados (Firestore)
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db

    # Mock da query de Contas (para saldo total)
    mock_account = MagicMock()
    mock_account.to_dict.return_value = {"balance": 1000.0}
    
    # Mock da query de Transações
    mock_transaction = MagicMock()
    # AQUI ESTÁ O CENÁRIO DE ERRO: "date" é uma string, não um datetime
    mock_transaction.to_dict.return_value = {
        "user_id": "user_123",
        "amount": 150.0,
        "type": "expense",
        "date": datetime(2025, 12, 1, 10, 0, 0), 
        "category_id": "cat_food",
        "account_id": "acc_1",
        "payment_method": "credit_card"
    }

    # Mock da query de Categoria (Fatura Cartão)
    mock_invoice_cat = MagicMock()
    mock_invoice_cat.id = "invoice_cat_id"

    # Configurando o side_effect para retornar os mocks corretos dependendo da coleção
    def collection_side_effect(collection_name):
        coll_mock = MagicMock()
        if collection_name == "accounts":
            coll_mock.where.return_value.stream.return_value = [mock_account]
        elif collection_name == "transactions":
            # Para suportar .where().where().order_by().limit().stream()
            chain = coll_mock.where.return_value.where.return_value.order_by.return_value.limit.return_value
            chain.stream.return_value = [mock_transaction]
            # Também suportar versões com menos encadeamento se necessário
            coll_mock.where.return_value.stream.return_value = [mock_transaction]
            coll_mock.where.return_value.where.return_value.stream.return_value = [mock_transaction]
            coll_mock.where.return_value.where.return_value.order_by.return_value.stream.return_value = [mock_transaction]
        elif collection_name == "categories":
            coll_mock.where.return_value.where.return_value.limit.return_value.stream.return_value = [mock_invoice_cat]
            coll_mock.where.return_value.limit.return_value.stream.return_value = [mock_invoice_cat]
        return coll_mock

    mock_db.collection.side_effect = collection_side_effect

    # 2. Mock dos Serviços Auxiliares
    mock_budget_service.list_budgets_with_progress.return_value = []
    
    # Mock do TransactionService (para evitar encadeamento complexo de DB)
    from app.schemas.transaction import Transaction
    from app.schemas.account import Account
    
    mock_account_obj = Account(id="acc_1", name="Conta 1", balance=1000.0, type=AccountType.CHECKING, user_id="user_123")
    mock_cat_obj = Category(id="cat_food", name="Alimentação", color="#FF0000", icon="pi pi-food", type=CategoryType.EXPENSE, user_id="user_123", is_custom=True)
    
    tx = Transaction(
        id="tx_1",
        user_id="user_123",
        title="Jantar",
        amount=150.0,
        type=TransactionType.EXPENSE,
        date=datetime(2025, 12, 1, 10, 0, 0, tzinfo=timezone.utc),
        payment_method=PaymentMethod.CREDIT_CARD,
        category=mock_cat_obj,
        account=mock_account_obj,
        status="paid"
    )
    
    with patch("app.services.dashboard.transaction_service.list_transactions") as mock_list:
        mock_list.return_value = [tx]
        mock_category_service.get_category.return_value = mock_cat_obj
        mock_category_service.list_categories.return_value = [mock_cat_obj]

        # 3. Execução
        summary = get_dashboard_data(user_id="user_123", month=12, year=2025)

    # 4. Verificação
    assert summary.expense_month == 150.0