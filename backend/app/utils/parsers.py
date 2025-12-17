import pandas as pd
from ofxparse import OfxParser
from typing import List, Dict, Optional
from datetime import datetime
import io

def parse_ofx(file_content: bytes) -> List[Dict]:
    """
    Parses an OFX file content and returns a list of transactions.
    """
    try:
        ofx = OfxParser.parse(io.BytesIO(file_content))
        transactions = []
        
        # Iterate over all accounts in the OFX
        for account in ofx.accounts:
            for t in account.statement.transactions:
                # OFX transactions usually have: date, amount, id, memo, payee, type
                transactions.append({
                    "date": t.date.isoformat(),
                    "amount": float(t.amount),
                    "description": t.memo or t.payee or "No Description",
                    "type": "income" if t.amount > 0 else "expense",
                    "source": "ofx"
                })
        return transactions
    except Exception as e:
        print(f"Error parsing OFX: {e}")
        return []

def parse_csv(file_content: bytes) -> List[Dict]:
    """
    Parses a CSV file content and returns a list of transactions.
    Tries to infer columns for Date, Description, Amount.
    """
    try:
        # Load CSV
        df = pd.read_csv(io.BytesIO(file_content))
        
        # Normalize headers to lowercase
        df.columns = df.columns.str.lower().str.strip()
        
        # 1. Identify Date Column
        date_col = next((c for c in df.columns if 'date' in c or 'data' in c or 'dt' in c), None)
        
        # 2. Identify Description Column
        desc_col = next((c for c in df.columns if 'desc' in c or 'historico' in c or 'memo' in c or 'estabelecimento' in c), None)
        
        # 3. Identify Amount Column
        amount_col = next((c for c in df.columns if 'amount' in c or 'valor' in c or 'value' in c), None)
        
        if not (date_col and desc_col and amount_col):
             # Fallback/Error if columns not found
             # Could try index-based if consistent (0=Date, 1=Desc, 2=Amount)
             return []

        transactions = []
        for _, row in df.iterrows():
            try:
                # Parse Amount (HANDLE BRAZILIAN FORMAT 1.000,00 vs 1000.00)
                raw_amount = str(row[amount_col])
                if ',' in raw_amount and '.' in raw_amount:
                     # 1.000,00 -> 1000.00
                     raw_amount = raw_amount.replace('.', '').replace(',', '.')
                elif ',' in raw_amount:
                     # 1000,00 -> 1000.00
                     raw_amount = raw_amount.replace(',', '.')
                
                amount = float(raw_amount)
                
                # Parse Date (Try multiple formats)
                raw_date = str(row[date_col])
                parsed_date = None
                for fmt in ['%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y', '%Y/%m/%d']:
                    try:
                        parsed_date = datetime.strptime(raw_date, fmt)
                        break
                    except:
                        pass
                
                if not parsed_date:
                    continue # Skip invalid dates

                transactions.append({
                    "date": parsed_date.isoformat(),
                    "amount": amount,
                    "description": str(row[desc_col]),
                    "type": "income" if amount > 0 else "expense",
                    "source": "csv"
                })
            except Exception as row_err:
                print(f"Skipping row {row}: {row_err}")
                continue
                
        return transactions

    except Exception as e:
        print(f"Error parsing CSV: {e}")
        return []
