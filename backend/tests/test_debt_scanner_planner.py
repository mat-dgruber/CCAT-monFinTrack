import pytest
from unittest.mock import patch, MagicMock
from app.services.document_analysis import DocumentAnalysisService
from app.services.debt_service import generate_payment_plan
from app.schemas.debt import Debt, InterestPeriod, DebtType

# --- Test Data ---
MOCK_DEBT_1 = Debt(
    id="debt1",
    debt_id="debt1",
    user_id="test_user",
    name="Card A",
    debt_name="Card A",
    total_amount=1000.0,
    remaining_balance=1000.0,
    interest_rate=10.0, # 10% monthly
    interest_period=InterestPeriod.MONTHLY,
    minimum_payment=50.0,
    debt_type=DebtType.CREDIT_CARD_ROTATING,
    created_at="2024-01-01",
    interest_paid=0,
    principal_paid=0
)

MOCK_DEBT_2 = Debt(
    id="debt2",
    debt_id="debt2",
    user_id="test_user",
    name="Loan B",
    debt_name="Loan B",
    total_amount=5000.0,
    remaining_balance=5000.0,
    interest_rate=2.0, # 2% monthly
    interest_period=InterestPeriod.MONTHLY,
    minimum_payment=200.0,
    debt_type=DebtType.PERSONAL_LOAN,
    created_at="2024-01-01",
    interest_paid=0,
    principal_paid=0
)

# --- Tests for IA Scanner (Document Analysis) ---

@patch("app.services.document_analysis.get_preferences")
@patch("app.services.document_analysis.genai.GenerativeModel")
@patch("app.services.document_analysis.GENAI_API_KEY", "fake_key") # Ensure key check passes
def test_analyze_debt_document_success(mock_model_cls, mock_get_pref):
    # Mock User Tier
    mock_pref = MagicMock()
    mock_pref.subscription_tier = 'premium'
    mock_get_pref.return_value = mock_pref

    # Mock AI Response
    mock_model_instance = MagicMock()
    mock_response = MagicMock()
    mock_response.text = """
    ```json
    {
        "name": "Bank X",
        "total_amount": 1500.00,
        "interest_rate": 5.5,
        "debt_type": "credit_card"
    }
    ```
    """
    mock_model_instance.generate_content.return_value = mock_response
    mock_model_cls.return_value = mock_model_instance

    # Call Service
    result = DocumentAnalysisService.analyze_debt_document("user_123", b"fake_content", "application/pdf")

    # Assertions
    assert result["name"] == "Bank X"
    assert result["total_amount"] == 1500.00
    assert result["debt_type"] == "credit_card"
    mock_model_cls.assert_called()

@patch("app.services.document_analysis.get_preferences")
def test_analyze_debt_document_free_tier(mock_get_pref):
    # Mock Free Tier
    mock_pref = MagicMock()
    mock_pref.subscription_tier = 'free'
    mock_get_pref.return_value = mock_pref

    result = DocumentAnalysisService.analyze_debt_document("user_123", b"fake_content", "application/pdf")
    
    assert "error" in result
    assert "Premium" in result["error"]

# --- Tests for Debt Planner (Simulation) ---

@patch("app.services.debt_service.list_debts")
@patch("app.services.debt_service.get_preferences")
def test_generate_payment_plan_avalanche(mock_get_pref, mock_list_debts):
    # Mock User Tier
    mock_pref = MagicMock()
    mock_pref.subscription_tier = 'pro' # Plan available for Pro
    mock_get_pref.return_value = mock_pref

    # Mock Debts
    mock_list_debts.return_value = [MOCK_DEBT_1, MOCK_DEBT_2]

    # Strategy: Avalanche (Highest Rate First) -> Card A (10%) should be paid before Loan B (2%)
    # Budget: 500. Mins: 50 + 200 = 250. Extra: 250.
    # Card A Balance 1000. Extra 250/mo -> ~4 months to pay off Card A (plus mins).
    
    plan = generate_payment_plan("user_123", strategy="avalanche", monthly_budget=500.0)

    assert plan.strategy == "avalanche"
    assert len(plan.debt_summaries) == 2
    
    # Check payoff order logic implicitly by payoff months
    # Card A should be paid off sooner relative to its size/rate if prioritized
    card_a_summary = next(s for s in plan.debt_summaries if s.debt_id == "debt1")
    loan_b_summary = next(s for s in plan.debt_summaries if s.debt_id == "debt2")
    
    # Just ensure we have a valid plan
    assert card_a_summary.payoff_months > 0
    assert loan_b_summary.payoff_months > 0
    assert plan.total_months > 0

@patch("app.services.debt_service.list_debts")
@patch("app.services.debt_service.get_preferences")
def test_generate_payment_plan_snowball(mock_get_pref, mock_list_debts):
    # Mock User Tier
    mock_pref = MagicMock()
    mock_pref.subscription_tier = 'pro'
    mock_get_pref.return_value = mock_pref

    # Mock Debts
    mock_list_debts.return_value = [MOCK_DEBT_1, MOCK_DEBT_2]
    
    # Strategy: Snowball (Lowest Balance First) -> Card A (1000) before Loan B (5000)
    # Happily, Card A is also the highest rate, so Snowball/Avalanche match order here,
    # but let's just verify function runs correctly.
    
    plan = generate_payment_plan("user_123", strategy="snowball", monthly_budget=1000.0)

    assert plan.strategy == "snowball"
    assert plan.total_months > 0
