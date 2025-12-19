from typing import Dict, Any, Optional
from app.models.debt import AmortizationSystem

class FinancingSimulator:
    """
    Simulation logic for Brazilian Housing Financing (MCMV / SBPE).
    Note: These are estimates based on 2024/2025 CAIXA public data.
    """

    @staticmethod
    def get_mcmv_defaults(monthly_gross_income: float, region: str = "national") -> Dict[str, Any]:
        """
        Returns 'Smart Defaults' for interest rates based on income brackets (Faixas).
        Region can slightly affect Faixa 1 rates, but we use a national average for simplicity if not specified.
        """
        # Brackets and Rates (Approximate 2024/2025)
        # Faixa 1: Up to R$ 2.850
        # Faixa 2: R$ 2.850,01 to R$ 4.700
        # Faixa 3: R$ 4.700,01 to R$ 8.000
        # SBPE: Above R$ 8.000

        rate = 10.0 # Default market rate
        program = "SBPE (Sistema Financeiro de Habitação)"
        max_subsidy = 0.0

        if monthly_gross_income <= 2850:
            rate = 4.25 # Avg between 4.0 and 4.5
            program = "Minha Casa Minha Vida - Faixa 1"
            max_subsidy = 55000 # Historic max, varies heavily by city
        elif monthly_gross_income <= 4700:
            rate = 5.50 # Avg between 4.75 and 7.00
            program = "Minha Casa Minha Vida - Faixa 2"
            max_subsidy = 55000 
        elif monthly_gross_income <= 8000:
            rate = 7.66 # Lowest nominal rate for Faixa 3 with FGTS
            program = "Minha Casa Minha Vida - Faixa 3"
        else:
            rate = 9.50 # Typical starting rate for SBPE user relationship
        
        return {
            "suggested_rate_yearly": rate,
            "program_name": program,
            "max_subsidy_estimate": max_subsidy,
            "max_financeable_ratio": 0.80 # Usually 80% for SBPE/MCMV
        }
    
    @staticmethod
    def _calculate_sac(principal: float, rate_monthly: float, months: int) -> Dict[str, Any]:
        """
        SAC: Constant Amortization System.
        Principal / Months = Amortization (Constant)
        Interest = Remaining Balance * Rate
        Payment = Amortization + Interest
        """
        amortization = principal / months
        total_interest = 0
        first_installment = 0
        last_installment = 0
        
        remaining = principal
        
        for i in range(months):
            interest = remaining * rate_monthly
            installment = amortization + interest
            total_interest += interest
            
            if i == 0:
                first_installment = installment
            if i == months - 1:
                last_installment = installment
                
            remaining -= amortization
            
        return {
            "first_installment": first_installment,
            "last_installment": last_installment,
            "total_interest": total_interest,
            "total_paid": principal + total_interest,
            "amortization_system": AmortizationSystem.SAC
        }

    @staticmethod
    def _calculate_price(principal: float, rate_monthly: float, months: int) -> Dict[str, Any]:
        """
        PRICE: Constant Installment.
        PMT = Principal * [rate * (1+rate)^n] / [(1+rate)^n - 1]
        """
        if rate_monthly == 0:
             return {
                "first_installment": principal / months,
                "last_installment": principal / months,
                "total_interest": 0,
                "total_paid": principal,
                "amortization_system": AmortizationSystem.PRICE
            }

        pow_factor = (1 + rate_monthly) ** months
        installment = principal * (rate_monthly * pow_factor) / (pow_factor - 1)
        
        total_paid = installment * months
        total_interest = total_paid - principal
        
        return {
            "first_installment": installment,
            "last_installment": installment, # Fixed
            "total_interest": total_interest,
            "total_paid": total_paid,
            "amortization_system": AmortizationSystem.PRICE
        }

    @classmethod
    def simulate_simulation(cls, 
                            property_value: float, 
                            entry_value: float, 
                            interest_rate_yearly: float, 
                            months: int,
                            system: AmortizationSystem = AmortizationSystem.SAC) -> Dict[str, Any]:
        
        principal = property_value - entry_value
        if principal <= 0:
            return {"error": "Entry value covers the property price."}
            
        # Convert Yearly Effective Rate to Monthly
        # Formula: (1 + i_yearly)^(1/12) - 1
        rate_monthly = ((1 + (interest_rate_yearly / 100)) ** (1/12)) - 1
        
        if system == AmortizationSystem.SAC:
            result = cls._calculate_sac(principal, rate_monthly, months)
        else:
            result = cls._calculate_price(principal, rate_monthly, months)
            
        result["principal"] = principal
        result["interest_rate_monthly_perc"] = rate_monthly * 100
        return result
