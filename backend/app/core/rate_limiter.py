from datetime import datetime, timedelta
from fastapi import HTTPException
from collections import defaultdict

class RateLimiter:
    def __init__(self):
        # Armazena uso em memória: {user_id: {'classify': [timestamps], 'chat': [timestamps]}}
        self.usage = defaultdict(lambda: defaultdict(list))
        
        # Base limits (fallback)
        self.DEFAULT_LIMITS = {
            'classify': 20,
            'chat': 20
        }

    def check_limit(self, user_id: str, action: str, tier: str = 'free'):
        """
        Verifica se o usuário excedeu o limite para a ação, baseado no plano.
        """
        now = datetime.now()
        
        # 1. Determina o limite baseado no Tier
        limit = 0 # Default (Free)
        
        if tier == 'premium':
            limit = 1000 # "Unlimited"
        elif tier == 'pro':
            limit = 20 # Standard Limit
        elif tier == 'free':
            limit = 0 # No AI
            
        # 2. Se limite é 0, bloqueia imediatamente
        if limit == 0:
             raise HTTPException(
                status_code=403, 
                detail=f"Feature '{action}' is not available for Free plan. Please upgrade."
            )

        # 3. Limpa timestamps antigos (> 24h)
        self._cleanup(user_id, action, now)
        
        # 4. Verifica contagem
        count = len(self.usage[user_id][action])
        
        if count >= limit:
            raise HTTPException(
                status_code=429, 
                detail=f"Rate limit exceeded for '{action}'. Max {limit} per day. Upgrade to Premium for unlimited access."
            )
            
        # 5. Registra uso
        self.usage[user_id][action].append(now)

    def _cleanup(self, user_id: str, action: str, now: datetime):
        # Remove timestamps com mais de 24 horas
        cutoff = now - timedelta(days=1)
        self.usage[user_id][action] = [t for t in self.usage[user_id][action] if t > cutoff]

# Singleton instance
limiter = RateLimiter()
