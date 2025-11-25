from pydantic import BaseModel
from typing import List
from app.schemas.budget import Budget

class CategoryTotal(BaseModel):
     category_name: str
     color: str
     total: float

class BudgetSummary(Budget):
    spent: float = 0.0

class DashboardSummary(BaseModel):
     total_balance: float
     income_month: float
     expense_month: float
     expenses_by_category: List[CategoryTotal]
     budgets: List[BudgetSummary]