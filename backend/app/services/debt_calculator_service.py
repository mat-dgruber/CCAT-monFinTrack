from datetime import date
from dateutil.relativedelta import relativedelta
import math
from typing import List, Dict, Any

class DebtCalculatorService:
    
    @staticmethod
    def calculate_present_value(parcel_value: float, monthly_interest_rate: float, due_date: date, payment_date: date = None) -> Dict[str, Any]:
        """
        Calcula o desconto ao antecipar uma única parcela (Desconto Racional Composto).
        
        :param parcel_value: Valor cheio da parcela (VF).
        :param monthly_interest_rate: Taxa em porcentagem (ex: 1.5 para 1.5%).
        :param due_date: Data original de vencimento da parcela.
        :param payment_date: Data em que se pretende pagar (default: hoje).
        """
        if payment_date is None:
            payment_date = date.today()
            
        if payment_date >= due_date:
            return {
                "pay_amount": parcel_value,
                "discount": 0.0,
                "discount_percent": 0.0,
                "months_anticipated": 0
            }

        # 1. Calcular a diferença de meses (n)
        delta = relativedelta(due_date, payment_date)
        months_anticipated = delta.years * 12 + delta.months + (delta.days / 30.0)
        
        # 2. Converter taxa para decimal (i)
        i = monthly_interest_rate / 100.0
        
        # 3. Fórmula do Valor Presente: VP = VF / (1 + i)^n
        present_value = parcel_value / ((1 + i) ** months_anticipated)
        
        discount = parcel_value - present_value
        
        return {
            "original_amount": round(parcel_value, 2),
            "discounted_amount": round(present_value, 2),
            "discount_obtained": round(discount, 2),
            "percent_saved": round((discount / parcel_value) * 100, 2),
            "months_anticipated": round(months_anticipated, 1)
        }

    @staticmethod
    def simulate_bulk_amortization(extra_balance: float, installments: List[Dict[str, Any]], monthly_interest_rate: float) -> Dict[str, Any]:
        """
        Simula: "Tenho R$ 1.000, quantas das ÚLTIMAS parcelas eu consigo matar?"
        
        :param extra_balance: O dinheiro disponível para amortizar (ex: R$ 1.000,00).
        :param installments: Lista de dicts [{'number': 48, 'value': 500.0, 'due_date': date(...) }, ...]. 
        """
        
        available_money = extra_balance
        installments_paid = []
        total_savings = 0.0
        
        # Ordena as parcelas de trás pra frente (para matar as últimas primeiro)
        # Assumindo chave 'due_date' como date object
        sorted_installments = sorted(installments, key=lambda x: x['due_date'], reverse=True)
        
        for p in sorted_installments:
            # Calcula quanto custa essa parcela HOJE
            simulation = DebtCalculatorService.calculate_present_value(
                parcel_value=p['value'],
                monthly_interest_rate=monthly_interest_rate,
                due_date=p['due_date']
            )
            
            cost_today = simulation['discounted_amount']
            
            if available_money >= cost_today:
                available_money -= cost_today
                total_savings += simulation['discount_obtained']
                installments_paid.append({
                    "installment_number": p['number'],
                    "real_cost": cost_today,
                    "savings": simulation['discount_obtained']
                })
            else:
                # Acabou o dinheiro
                break
                
        return {
            "invested_amount": round(extra_balance - available_money, 2),
            "total_saved": round(total_savings, 2),
            "installments_removed_count": len(installments_paid),
            "details": installments_paid,
            "change": round(available_money, 2)
        }
