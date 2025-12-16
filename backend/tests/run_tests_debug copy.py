import pytest
import sys

if __name__ == "__main__":
    with open("debug_output.txt", "w", encoding="utf-8") as f:
        # Redirect stdout and stderr to the file
        sys.stdout = f
        sys.stderr = f
        
        # Run pytest with verbose and no color
        retcode = pytest.main(["-v", "tests/test_account_service.py", "tests/test_budget_service.py", "tests/test_transaction_service.py", "--color=no", "--capture=no"])
