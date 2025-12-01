from datetime import datetime, time, timezone
import calendar

def get_month_range(month: int, year: int):
    """
    Retorna dois objetos datetime: o primeiro e o último segundo do mês.
    """
    # Primeiro dia do mês às 00:00:00
    start_date = datetime(year, month, 1, 0, 0, 0, tzinfo=timezone.utc)
    
    # Último dia do mês
    last_day = calendar.monthrange(year, month)[1]
    
    # Último dia às 23:59:59
    end_date = datetime(year, month, last_day, 23, 59, 59, tzinfo=timezone.utc)
    
    return start_date, end_date
    return start_date, end_date

def calculate_next_due_date(current_date: datetime, periodicity: str) -> datetime:
    """
    Calcula a próxima data de vencimento baseada na periodicidade.
    """
    # Importação local para evitar ciclo se houver
    from dateutil.relativedelta import relativedelta
    
    if periodicity == "mensal":
        return current_date + relativedelta(months=1)
    elif periodicity == "bimestral":
        return current_date + relativedelta(months=2)
    elif periodicity == "trimestral":
        return current_date + relativedelta(months=3)
    elif periodicity == "semestral":
        return current_date + relativedelta(months=6)
    elif periodicity == "anual":
        return current_date + relativedelta(years=1)
    
    return current_date
