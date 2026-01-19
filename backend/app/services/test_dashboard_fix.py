import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime
from app.services.dashboard import get_dashboard_data

@patch("app.services.dashboard.get_db")
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
        "date": "2025-12-01T10:00:00", 
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
            coll_mock.where.return_value.stream.return_value = [mock_transaction]
        elif collection_name == "categories":
            coll_mock.where.return_value.limit.return_value.stream.return_value = [mock_invoice_cat]
        return coll_mock

    mock_db.collection.side_effect = collection_side_effect

    # 2. Mock dos Serviços Auxiliares
    mock_budget_service.list_budgets_with_progress.return_value = []
    
    mock_cat_obj = MagicMock()
    mock_cat_obj.name = "Alimentação"
    mock_cat_obj.color = "#FF0000"
    mock_category_service.get_category.return_value = mock_cat_obj

    # 3. Execução
    try:
        summary = get_dashboard_data(user_id="user_123", month=12, year=2025)
    except AttributeError as e:
        pytest.fail(f"A função falhou com AttributeError ao processar data string: {e}")

    # 4. Verificação
    assert summary.expense_month == 150.0