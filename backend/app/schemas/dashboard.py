from pydantic import BaseModel
from typing import List

class CategoryTotal(BaseModel):
     category_name: str
     color: str
     total: float

class DashboardSummary(BaseModel):
     total_balance: float
     income_month: float
     expense_month: float
     expenses_by_category: List[CategoryTotal]