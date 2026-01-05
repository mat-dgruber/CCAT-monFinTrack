
from firebase_admin import messaging
from typing import List

class NotificationService:
    def send_to_token(self, token: str, title: str, body: str, data: dict = None):
        """
        Envia notificação para um único dispositivo.
        """
        try:
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                ),
                data=data or {},
                token=token,
            )
            response = messaging.send(message)
            return response
        except Exception as e:
            print(f"❌ Erro ao enviar push para token {token}: {e}")
            return None

    def send_multicast(self, tokens: List[str], title: str, body: str, data: dict = None):
        """
        Envia notificação para múltiplos dispositivos.
        """
        if not tokens:
            return

        try:
            message = messaging.MulticastMessage(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                ),
                data=data or {},
                tokens=tokens,
            )
            response = messaging.send_multicast(message)
            # Response tem success_count, failure_count, etc.
            if response.failure_count > 0:
                 print(f"⚠️ {response.failure_count} falhas ao enviar multicast.")
            
            return response
        except Exception as e:
            print(f"❌ Erro ao enviar push multicast: {e}")
            return None

notification_service = NotificationService()
