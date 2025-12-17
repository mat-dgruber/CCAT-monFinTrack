from google.cloud import firestore
from app.core.database import get_db
import statistics
from datetime import datetime, timedelta
from typing import Optional

class AnalysisService:
    def analyze_transaction(self, user_id: str, amount: float, category_id: str) -> Optional[str]:
        """
        Calcula se o valor foge do padrão (Média + 2x Desvio Padrão).
        Retorna string de alerta ou None.
        """
        try:
            db = get_db()
            
            # Pega as ultimas 20 transacoes da mesma categoria
            docs = (
                db.collection("transactions")
                .where("user_id", "==", user_id)
                .where("category_id", "==", category_id)
                .order_by("date", direction=firestore.Query.DESCENDING)
                .limit(20)
                .stream()
            )

            amounts = []
            for doc in docs:
                data = doc.to_dict()
                val = float(data.get("amount", 0))
                amounts.append(val)

            # Precisa de histórico minimo
            if len(amounts) < 5:
                return None

            mean = statistics.mean(amounts)
            if mean == 0:
                return None
            
            try:
                stdev = statistics.stdev(amounts)
            except:
                stdev = 0

            # Limiar: Se desvio for muito pequeno (< 10% da media ou < 5 reais),
            # usa um teto fixo de 2x a média para evitar alertas chatos em valores baixos
            if stdev < 5: 
                threshold = mean * 2.0
            else:
                threshold = mean + (2 * stdev)

            # Se amount explodir o threshold
            if amount > threshold:
                percent = ((amount - mean) / mean) * 100
                return f"⚠️ Gasto Anômalo: R${amount:.2f} é {percent:.0f}% maior que sua média (R${mean:.2f})."

            return None
            
        except Exception as e:
            print(f"[Analysis] Erro: {e}")
            return None


    def detect_subscriptions(self, user_id: str) -> list[dict]:
        """
        Analisa o histórico em busca de assinaturas não cadastradas.
        Critérios:
        - Nome similar aparecendo pelo menos 3 vezes nos últimos 90 dias.
        - Valores próximos (variação < 10%).
        - NÃO estar na lista de recorrências ativas.
        """
        try:
            db = get_db()
            
            # 1. Busca recorrências ativas para exclusão
            from app.services import recurrence as recurrence_service
            active_recs = recurrence_service.list_recurrences(user_id, active_only=True)
            active_titles = {rec.title.lower().strip() for rec in active_recs}
            
            # 2. Busca transações dos últimos 90 dias
            cutoff = datetime.now() - timedelta(days=90)
            
            docs = (
                db.collection("transactions")
                .where("user_id", "==", user_id)
                .where("date", ">=", cutoff)
                .where("type", "==", "expense") # Apenas despesas
                .order_by("date", direction=firestore.Query.DESCENDING)
                .stream()
            )
            
            # 3. Agrupamento (In-Memory Processing)
            groups = {}
            for doc in docs:
                data = doc.to_dict()
                title = data.get('title', '').strip().lower()
                amount = float(data.get('amount', 0))
                
                # Ignora se já é recorrência registrada
                if data.get('is_recurrence') or title in active_titles:
                    continue
                    
                if title not in groups:
                    groups[title] = []
                groups[title].append(amount)
                
            # 4. Filtragem
            candidates = []
            for title, amounts in groups.items():
                # Frequência Mínima: 3 vezes em 90 dias (aprox 1x por mês)
                if len(amounts) >= 3:
                    avg_price = statistics.mean(amounts)
                    try:
                        stdev = statistics.stdev(amounts)
                    except:
                        stdev = 0
                        
                    # Consistência de Preço: Variação baixa (CV < 10%)
                    # Ex: Netflix 55.90 é sempre 55.90. Uber varia muito.
                    if avg_price > 0 and (stdev / avg_price) < 0.1:
                         candidates.append({
                             "title": title.title(),
                             "avg_amount": round(avg_price, 2),
                             "recurrence_periodicity": "monthly", # Chute seguro
                             "confidence": "High" if stdev == 0 else "Medium"
                         })
                         
            return candidates

        except Exception as e:
            print(f"[Analysis] Subscription Error: {e}")
            return []

analysis_service = AnalysisService()
