from datetime import datetime, time
import calendar

def get_month_range(month: int, year: int):
    """
    Retorna dois objetos datetime: o primeiro e o último segundo do mês.
    """
    # Primeiro dia do mês às 00:00:00
    start_date = datetime(year, month, 1, 0, 0, 0)
    
    # Último dia do mês
    last_day = calendar.monthrange(year, month)[1]
    
    # Último dia às 23:59:59
    end_date = datetime(year, month, last_day, 23, 59, 59)
    
    return start_date, end_date
