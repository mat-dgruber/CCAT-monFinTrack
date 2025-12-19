from enum import Enum

class DebtType(str, Enum):
    CREDIT_CARD_ROTATING = "credit_card_rotating" # Cartão de Crédito (Rotativo)
    CREDIT_CARD_INSTALLMENT = "credit_card_installment" # Parcelado no Cartão
    OVERDRAFT = "overdraft" # Cheque Especial
    PERSONAL_LOAN = "personal_loan" # Empréstimo Pessoal
    CONSIGNED_CREDIT = "consigned_credit" # Empréstimo Consignado
    VEHICLE_FINANCING = "vehicle_financing" # Financiamento de Veículo
    REAL_ESTATE_FINANCING = "real_estate_financing" # Financiamento Imobiliário (MCMV/SBPE)
    OTHER = "other" # Outros

class InterestPeriod(str, Enum):
    MONTHLY = "monthly"
    YEARLY = "yearly"

class AmortizationSystem(str, Enum):
    SAC = "sac" # Sistema de Amortização Constante (parcelas decrescentes)
    PRICE = "price" # Tabela Price (parcelas fixas)
    NONE = "none"
