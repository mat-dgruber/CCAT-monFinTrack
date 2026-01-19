import sys
import os
from datetime import date
from dateutil.relativedelta import relativedelta

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.services.debt_calculator_service import DebtCalculatorService

def test_present_value():
    print("--- Testing Present Value ---")
    # Scenario: $1000 due in 1 year (12 months), 1% monthly interest
    # VP = 1000 / (1.01)^12
    # VP ~= 1000 / 1.1268 ~= 887.45
    
    due_date = date.today() + relativedelta(months=12)
    result = DebtCalculatorService.calculate_present_value(
        parcel_value=1000.0,
        monthly_interest_rate=1.0,
        due_date=due_date
    )
    
    print(f"Result: {result}")
    assert result['discounted_amount'] < 1000.0
    assert result['months_anticipated'] >= 11.9
    print("✅ Present Value Test Passed")

def test_bulk_amortization():
    print("\n--- Testing Bulk Amortization ---")
    # Scenario: Have $2000. Installments of $1000 each.
    # Last one (month 12) costs ~887. Second to last (month 11) costs ~896.
    # Total cost for 2 = ~1783. Should pay 2 installments.
    
    installments = []
    for i in range(12, 0, -1):
        installments.append({
            "number": i,
            "value": 1000.0,
            "due_date": date.today() + relativedelta(months=i)
        })
        
    result = DebtCalculatorService.simulate_bulk_amortization(
        extra_balance=2000.0,
        installments=installments,
        monthly_interest_rate=1.0
    )
    
    print(f"Result: {result}")
    assert result['installments_removed_count'] >= 2
    assert result['invested_amount'] < 2000.0
    print("✅ Bulk Amortization Test Passed")

if __name__ == "__main__":
    try:
        test_present_value()
        test_bulk_amortization()
        print("\n🎉 ALL TESTS PASSED")
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        exit(1)
