from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from app.core.database import get_db

class RateLimiter:
    def __init__(self):
        # Base limits (fallback)
        self.DEFAULT_LIMITS = {
            'classify': 20,
            'chat': 20
        }

    def _get_clean_timestamps(self, timestamps, cutoff):
        """Helper to filter old timestamps"""
        valid = []
        for t in timestamps:
            # Handle string dates if any (legacy)
            if isinstance(t, str):
                try:
                    t = datetime.fromisoformat(t)
                except ValueError:
                    continue
            
            # Ensure timezone awareness for comparison
            if isinstance(t, datetime):
                if t.tzinfo is None:
                    t = t.replace(tzinfo=timezone.utc)
                if t > cutoff:
                    valid.append(t)
        return valid

    def check_limit(self, user_id: str, action: str, tier: str = 'free'):
        """
        Verifica se o usuário excedeu o limite para a ação, baseado no plano.
        Persiste no Firestore.
        """
        now = datetime.now(timezone.utc)
        
        # 1. Determina o limite baseado no Tier
        limit = 0 # Default (Free)
        
        if tier == 'premium':
            limit = 500
        elif tier == 'pro':
            limit = 50
        elif tier == 'free':
            limit = 0
            
        # 2. Se limite é 0, bloqueia imediatamente
        if limit == 0:
             raise HTTPException(
                status_code=403, 
                detail=f"Feature '{action}' is not available for Free plan. Please upgrade."
            )

        # 3. Carrega do Firestore
        db = get_db()
        doc_ref = db.collection('rate_limits').document(user_id)
        doc = doc_ref.get()
        
        data = doc.to_dict() if doc.exists else {}
        timestamps = data.get(action, [])

        # 4. Limpa timestamps antigos (> 24h)
        cutoff = now - timedelta(days=1)
        valid_timestamps = self._get_clean_timestamps(timestamps, cutoff)
        
        # 5. Verifica contagem
        count = len(valid_timestamps)
        
        if count >= limit:
            # Update cleaned timestamps even if blocked, to save space? 
            # Optional, but good practice.
            if len(timestamps) != len(valid_timestamps):
                 doc_ref.set({action: valid_timestamps}, merge=True)
                 
            raise HTTPException(
                status_code=429, 
                detail=f"Rate limit exceeded for '{action}'. Max {limit} per day. Upgrade to Premium for unlimited access."
            )
            
        # 6. Registra uso e salva
        valid_timestamps.append(now)
        doc_ref.set({action: valid_timestamps}, merge=True)

    def get_usage_info(self, user_id: str, action: str, tier: str = 'free'):
        """
        Retorna informações de uso: {used, limit, remaining}
        """
        now = datetime.now(timezone.utc)
        
        # 1. Determina limite
        limit = 0
        if tier == 'premium':
            limit = 500
        elif tier == 'pro':
            limit = 50
        elif tier == 'free':
            limit = 0
            
        # 2. Carrega do Firestore
        db = get_db()
        doc_ref = db.collection('rate_limits').document(user_id)
        doc = doc_ref.get()
        
        data = doc.to_dict() if doc.exists else {}
        timestamps = data.get(action, [])
        
        # 3. Limpa timestamps antigos
        cutoff = now - timedelta(days=1)
        valid_timestamps = self._get_clean_timestamps(timestamps, cutoff)
        
        used = len(valid_timestamps)
        
        # Optional: Save cleaned list to DB if it changed significantly?
        # Let's avoid extra writes on GET unless necessary.
        
        return {
            'used': used,
            'limit': limit,
            'remaining': max(0, limit - used)
        }

# Singleton instance
limiter = RateLimiter()