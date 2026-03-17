from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


class SeasonalIncomeBase(BaseModel):
    name: str = Field(
        ..., min_length=2, description="Nome do recurso (Ex: 13º Salário, Bônus)"
    )
    amount: float = Field(..., ge=0, description="Valor líquido estimado")
    receive_date: date = Field(..., description="Data prevista de recebimento")
    is_recurrence: bool = Field(default=False, description="Se é recorrente (anual)")
    description: Optional[str] = Field(None, description="Observações adicionais")


class SeasonalIncomeCreate(SeasonalIncomeBase):
    pass


class SeasonalIncomeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2)
    amount: Optional[float] = Field(None, ge=0)
    receive_date: Optional[date] = None
    is_recurrence: Optional[bool] = None
    description: Optional[str] = None


class SeasonalIncome(SeasonalIncomeBase):
    id: str
    user_id: str

    class Config:
        from_attributes = True
