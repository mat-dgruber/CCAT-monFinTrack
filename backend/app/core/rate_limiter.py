from datetime import datetime, timedelta
from fastapi import HTTPException
from collections import defaultdict

class RateLimiter:
    def __init__(self):
        # Armazena uso em memória: {user_id: {'classify': [timestamps], 'chat': [timestamps]}}
        # Em produção, idealmente seria Redis. Como é MVP, memória funciona (reiniciou, zerou).
        self.usage = defaultdict(lambda: defaultdict(list))
        
        # Limites Diários
        self.LIMITS = {
            'classify': 20, # 20 categorizações novas por dia
            'chat': 20      # 20 mensagens de chat por dia
        }

    def check_limit(self, user_id: str, action: str):
        now = datetime.now()
        
        # 1. Limpa timestamps antigos (> 24h)
        self._cleanup(user_id, action, now)
        
        # 2. Verifica contagem
        count = len(self.usage[user_id][action])
        limit = self.LIMITS.get(action, 100)
        
        if count >= limit:
            raise HTTPException(
                status_code=429, 
                detail=f"Rate limit exceeded for '{action}'. Max {limit} per day. Try again tomorrow."
            )
            
        # 3. Registra uso
        self.usage[user_id][action].append(now)

    def _cleanup(self, user_id: str, action: str, now: datetime):
        # Remove timestamps com mais de 24 horas
        cutoff = now - timedelta(days=1)
        self.usage[user_id][action] = [t for t in self.usage[user_id][action] if t > cutoff]

# Singleton instance
limiter = RateLimiter()
