import pytest
from unittest.mock import MagicMock, patch
from app.services import budget as budget_service
from app.schemas.budget import BudgetCreate
from app.schemas.category import Category, CategoryType

@pytest.fixture
def mock_db():
    with patch("app.services.budget.get_db") as mock:
        mock_firestore_client = MagicMock()
        mock.return_value = mock_firestore_client
        yield mock_firestore_client

@pytest.fixture
def mock_category_service():
    with patch("app.services.budget.category_service") as mock:
        yield mock

def test_create_budget_success(mock_db, mock_category_service):
    # Setup
    user_id = "test_user_id"
    budget_in = BudgetCreate(category_id="cat1", amount=500.0)
    
    # Mock Category
    mock_cat = Category(
        id="cat1", name="Food", icon="pi", color="#000", type="expense", is_custom=False
    )
    mock_category_service.get_category.return_value = mock_cat
    
    # Mock DB add
    mock_doc_ref = MagicMock()
    mock_doc_ref.id = "budget1"
    mock_db.collection.return_value.add.return_value = (None, mock_doc_ref)
    
    # Execute
    result = budget_service.create_budget(budget_in, user_id)
    
    # Verify
    assert result.id == "budget1"
    assert result.amount == 500.0
    assert result.category.name == "Food"

def test_create_budget_invalid_type(mock_db, mock_category_service):
    # Setup
    user_id = "test_user_id"
    budget_in = BudgetCreate(category_id="cat_income", amount=500.0)
    
    # Mock Income Category
    mock_cat = Category(
        id="cat_income", name="Salary", icon="pi", color="#000", type="income", is_custom=False
    )
    mock_category_service.get_category.return_value = mock_cat
    
    # Execute & Verify
    with pytest.raises(Exception) as exc:
        budget_service.create_budget(budget_in, user_id)
    assert "Budgets can only be created for expense categories" in str(exc.value)

def test_list_budgets_with_progress(mock_db):
    # Setup
    user_id = "test_user_id"
    
    # 1. Mock Categories (Hierarchy)
    # Cat1 (Parent) -> Cat2 (Child)
    cat1_doc = MagicMock()
    cat1_doc.id = "cat1"
    cat1_doc.to_dict.return_value = {"name": "Food", "parent_id": None}
    
    cat2_doc = MagicMock()
    cat2_doc.id = "cat2"
    cat2_doc.to_dict.return_value = {"name": "Groceries", "parent_id": "cat1"}
    
    # Mock db.collection("categories").where().stream()
    # Problem: The service calls db.collection() multiple times for different collections.
    # verification: default mock returns same mock_collection for any call.
    # We need to distinguish based on collection name.
    
    # Advanced Mocking Strategy
    # We mock the return_value of db.collection(name) to return DIFFERENT mocks
    
    mock_cat_col = MagicMock()
    mock_budget_col = MagicMock()
    mock_trans_col = MagicMock()
    
    def side_effect_collection(name):
        if name == "categories": return mock_cat_col
        if name == "budgets": return mock_budget_col
        if name == "transactions": return mock_trans_col
        return MagicMock() # fallback
    
    mock_db.collection.side_effect = side_effect_collection
    
    # Configure Streams
    mock_cat_col.where.return_value.stream.return_value = [cat1_doc, cat2_doc]
    
    # 2. Mock Budgets
    # Budget for "cat1" (Food) with 1000 limit
    budget_doc = MagicMock()
    budget_doc.id = "budget1"
    budget_doc.to_dict.return_value = {"category_id": "cat1", "amount": 1000.0, "user_id": user_id}
    mock_budget_col.where.return_value.stream.return_value = [budget_doc]
    
    # 3. Mock Transactions
    # Spend 100 in Cat1, 200 in Cat2. Total for Cat1 budget should be 300.
    t1 = MagicMock()
    t1.to_dict.return_value = {"category_id": "cat1", "amount": 100.0, "type": "expense"}
    
    t2 = MagicMock()
    t2.to_dict.return_value = {"category_id": "cat2", "amount": 200.0, "type": "expense"}
    
    mock_trans_col.where.return_value.stream.return_value = [t1, t2]
    
    # Execute
    budgets = budget_service.list_budgets_with_progress(user_id)
    
    # Verify
    assert len(budgets) == 1
    b = budgets[0]
    assert b["category_id"] == "cat1"
    assert b["amount"] == 1000.0
    assert b["spent"] == 300.0 # 100 + 200
    assert b["percentage"] == 30.0

