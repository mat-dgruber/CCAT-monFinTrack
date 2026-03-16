import os
import sys

# Adjust path to find app modules
sys.path.append(
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../../backend"))
)

from app.core.logger import get_logger
from app.services import ai_service

logger = get_logger(__name__)


def test_real_user():
    user_id = "ukZ1mb73OTOC7bQjdEIdFcRADK72"
    month = 3
    year = 2026
    tier = "premium"

    print(f"Testing generate_monthly_report for REAL user {user_id}...")

    try:
        # Bypassing cache by changing a bit the inputs if necessary or just letting it run
        # We want to see the execution.
        result = ai_service.generate_monthly_report(user_id, month, year, tier)
        print("--- RESULT ---")
        print(result)
        print("--------------")
    except Exception as e:
        print(f"CRASHED: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    test_real_user()
