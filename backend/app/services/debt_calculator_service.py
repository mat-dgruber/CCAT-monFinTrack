#app/services/debt_calculator_service.py
import math
from datetime import date, datetime
from typing import Any, Dict, List

from dateutil.relativedelta import relativedelta


class DebtCalculatorService:

    @staticmethod
    def calculate_present_value(
        parcel_value: float,
        monthly_interest_rate: float,
        due_date: date,
        payment_date: date = None,
    ) -> Dict[str, Any]:
        """
        Calcula o desconto ao antecipar uma única parcela.
        """
        if payment_date is None:
            payment_date = date.today()

        if payment_date >= due_date:
            return {
                "original_amount": parcel_value,
                "discounted_amount": parcel_value,
                "discount_obtained": 0.0,
                "percent_saved": 0.0,
                "months_anticipated": 0,
            }

        # Calcular n (período de antecipação em meses)
        delta = relativedelta(due_date, payment_date)
        n = delta.years * 12 + delta.months + (delta.days / 30.0)

        i = monthly_interest_rate / 100.0

        # VP = VF / (1 + i)^n
        present_value = parcel_value / ((1 + i) ** n)
        discount = parcel_value - present_value

        return {
            "original_amount": round(parcel_value, 2),
            "discounted_amount": round(present_value, 2),
            "discount_obtained": round(discount, 2),
            "percent_saved": round((discount / parcel_value) * 100, 2),
            "months_anticipated": round(n, 1),
        }

    @staticmethod
    def simulate_amortization_impact(
        current_balance: float,
        monthly_interest_rate: float,
        current_installment: float,
        extra_payment: float,
        amortization_system: str = "price",
    ) -> Dict[str, Any]:
        """
        Simula Amortização Extra comparando as duas estratégias:
        1. Reduzir Prazo (Manter prestação)
        2. Reduzir Prestação (Manter prazo)
        """
        i = monthly_interest_rate / 100.0
        if i <= 0:
            return {"error": "Taxa inválida"}

        # --- Estado Atual (Antes da Amortização) ---
        # Prazo restante atual (n) = -log(1 - (PV*i/PMT)) / log(1+i)
        try:
            current_n = -math.log(
                1 - (current_balance * i / current_installment)
            ) / math.log(1 + i)
        except:
            current_n = current_balance / current_installment

        total_to_pay_original = current_n * current_installment

        # --- Após Amortização Extra ---
        new_balance = max(0, current_balance - extra_payment)

        # ESTRATÉGIA A: REDUZIR PRAZO (Mesma prestação)
        try:
            if new_balance > 0:
                n_term = -math.log(
                    1 - (new_balance * i / current_installment)
                ) / math.log(1 + i)
            else:
                n_term = 0
        except:
            n_term = new_balance / current_installment

        months_saved = max(0, current_n - n_term)
        total_to_pay_term = (n_term * current_installment) + extra_payment
        savings_term = total_to_pay_original - total_to_pay_term

        # ESTRATÉGIA B: REDUZIR PRESTAÇÃO (Mesmo prazo)
        # Novo PMT = PV_new * [i * (1+i)^n] / [(1+i)^n - 1]
        try:
            if new_balance > 0:
                new_installment = (
                    new_balance
                    * (i * (1 + i) ** current_n)
                    / ((1 + i) ** current_n - 1)
                )
            else:
                new_installment = 0
        except:
            new_installment = new_balance / current_n

        total_to_pay_inst = (current_n * new_installment) + extra_payment
        savings_inst = total_to_pay_original - total_to_pay_inst

        return {
            "summary": {
                "current_balance": round(current_balance, 2),
                "extra_payment": round(extra_payment, 2),
                "new_balance": round(new_balance, 2),
            },
            "reduce_term": {
                "months_saved": math.floor(months_saved),
                "interest_saved": round(savings_term, 2),
                "new_end_date": (
                    datetime.now() + relativedelta(months=math.floor(n_term))
                ).strftime("%m/%Y"),
                "multiplier": (
                    round(savings_term / extra_payment, 2) if extra_payment > 0 else 0
                ),
            },
            "reduce_installment": {
                "new_installment": round(new_installment, 2),
                "monthly_reduction": round(current_installment - new_installment, 2),
                "interest_saved": round(savings_inst, 2),
                "multiplier": (
                    round(savings_inst / extra_payment, 2) if extra_payment > 0 else 0
                ),
            },
        }

    @staticmethod
    def simulate_multiple_parcels(
        monthly_interest_rate: float,
        current_installment: float,
        count: int,
        payment_date: date = None,
    ) -> Dict[str, Any]:
        """
        Simula a antecipação das PRÓXIMAS 'count' parcelas.
        """
        if payment_date is None:
            payment_date = date.today()

        results = []
        total_to_pay = 0.0
        total_original = current_installment * count

        for m in range(1, count + 1):
            due_date = payment_date + relativedelta(months=m)
            sim = DebtCalculatorService.calculate_present_value(
                current_installment, monthly_interest_rate, due_date, payment_date
            )
            results.append(sim)
            total_to_pay += sim["discounted_amount"]

        return {
            "parcel_count": count,
            "total_original": round(total_original, 2),
            "total_to_pay": round(total_to_pay, 2),
            "total_discount": round(total_original - total_to_pay, 2),
            "months_reduced": count,  # Cada parcela antecipada reduz 1 mês do cronograma
            "details": results,
        }

    @staticmethod
    def simulate_revolving(
        balance: float,
        rate_monthly: float,      # já em decimal, ex: 0.15
        minimum_pct: float = 0.15,
        fixed_payment: float = 0.0,
    ) -> Dict[str, Any]:
        """
        Projeta rotativo/cheque especial pagando mínimo vs valor fixo.
        """
        from datetime import date
        from dateutil.relativedelta import relativedelta

        MAX_MONTHS = 600
        today = date.today()

        # --- Cenário 1: pagar mínimo ---
        saldo = balance
        total_pago_min = 0.0
        mes = 0
        s6, s12, s24 = 0.0, 0.0, 0.0
        data_dobra = None

        while saldo > 0.01 and mes < MAX_MONTHS:
            mes += 1
            saldo *= (1 + rate_monthly)
            pagamento = max(saldo * minimum_pct, 10.0)
            pagamento = min(pagamento, saldo)
            saldo -= pagamento
            total_pago_min += pagamento

            if mes == 6:  s6 = round(saldo, 2)
            if mes == 12: s12 = round(saldo, 2)
            if mes == 24: s24 = round(saldo, 2)
            if data_dobra is None and saldo >= balance * 2:
                data_dobra = (today + relativedelta(months=mes)).isoformat()

        # --- Cenário 2: valor fixo mensal ---
        meses_fixo = 0
        total_pago_fixo = 0.0
        saldo_fixo = balance
        valor_fixo = fixed_payment if fixed_payment > 0 else balance * 0.10

        if valor_fixo > 0:
            while saldo_fixo > 0.01 and meses_fixo < MAX_MONTHS:
                meses_fixo += 1
                saldo_fixo *= (1 + rate_monthly)
                pag = min(valor_fixo, saldo_fixo)
                saldo_fixo -= pag
                total_pago_fixo += pag
                if saldo_fixo <= 0:
                    break

        juros_total_fixo = total_pago_fixo - balance if total_pago_fixo > balance else 0.0

        return {
            "balance": round(balance, 2),
            "rate_monthly_pct": round(rate_monthly * 100, 4),
            "rate_yearly_pct": round(((1 + rate_monthly) ** 12 - 1) * 100, 2),
            "paying_minimum": {
                "minimum_pct": round(minimum_pct * 100, 1),
                "balance_6_months": s6,
                "balance_12_months": s12,
                "balance_24_months": s24,
                "doubling_date": data_dobra,
                "total_paid_12m": round(total_pago_min if mes >= 12 else total_pago_min, 2),
            },
            "paying_fixed": {
                "fixed_amount": round(valor_fixo, 2),
                "months_to_payoff": meses_fixo,
                "total_paid": round(total_pago_fixo, 2),
                "total_interest": round(juros_total_fixo, 2),
                "payoff_date": (today + relativedelta(months=meses_fixo)).isoformat(),
            },
            "pay_today_savings": round(total_pago_min - balance, 2),
        }

    @staticmethod
    def calculate_debt_stats(debt: Any) -> Dict[str, Any]:
        """
        Calcula estatísticas de custo e prioridade para uma dívida específica.
        """
        from app.models.debt import DebtType, InterestPeriod

        # 1. Converter taxa para mensal
        rate_monthly = debt.interest_rate / 100.0
        if debt.interest_period == InterestPeriod.YEARLY:
            rate_monthly = ((1 + rate_monthly) ** (1 / 12)) - 1

        # 2. Prioridade (0 a 100)
        # Baseada no tipo de dívida e na taxa de juros
        priority_score = 0
        if debt.debt_type in [DebtType.CREDIT_CARD_ROTATING, DebtType.OVERDRAFT]:
            priority_score = 80 + min(rate_monthly * 100, 20)
        elif debt.debt_type in [DebtType.PERSONAL_LOAN, DebtType.CONSIGNED_CREDIT]:
            priority_score = 50 + min(rate_monthly * 100 * 5, 30)
        else:
            priority_score = 20 + min(rate_monthly * 100 * 10, 30)

        priority_label = "Baixa"
        if priority_score > 70:
            priority_label = "Crítica (Pague Logo)"
        elif priority_score > 50:
            priority_label = "Alta"
        elif priority_score > 30:
            priority_label = "Média"

        # 3. Custo Total Restante (Estimativa "se não fizer nada")
        total_interest_remaining = 0.0
        months_remaining = 0

        if debt.debt_type in [DebtType.CREDIT_CARD_ROTATING, DebtType.OVERDRAFT]:
            # Para rotativo, projetamos 12 meses pagando o mínimo (ou 15%)
            proj = DebtCalculatorService.simulate_revolving(debt.total_amount, rate_monthly, 0.15)
            total_interest_remaining = proj["paying_minimum"]["total_paid_12m"] - debt.total_amount
            months_remaining = 12
        else:
            # Para financiamentos/empréstimos fixos
            # Se temos parcelas restantes e valor da parcela
            n = debt.remaining_installments or (
                debt.total_installments - debt.installments_paid if (debt.total_installments and debt.installments_paid) else 0)
            pmt = debt.minimum_payment or 0.0

            if n > 0 and pmt > 0:
                total_to_pay = n * pmt
                total_interest_remaining = max(0, total_to_pay - debt.total_amount)
                months_remaining = n
            elif rate_monthly > 0 and debt.total_amount > 0 and pmt > 0:
                # Tenta calcular n se não tivermos
                try:
                    n_calc = -math.log(1 - (debt.total_amount * rate_monthly / pmt)) / math.log(1 + rate_monthly)
                    total_interest_remaining = (n_calc * pmt) - debt.total_amount
                    months_remaining = round(n_calc)
                except:
                    total_interest_remaining = 0.0

        return {
            "priority_score": round(priority_score, 2),
            "priority_label": priority_label,
            "total_interest_remaining": round(max(0, total_interest_remaining), 2),
            "months_remaining": months_remaining,
            "monthly_rate": round(rate_monthly * 100, 4)
        }
