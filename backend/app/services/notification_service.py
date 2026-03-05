from typing import List

from app.core.logger import get_logger
from firebase_admin import messaging

logger = get_logger(__name__)


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
            logger.error("Erro ao enviar push para token %s: %s", token, e)
            return None

    def send_multicast(
        self, tokens: List[str], title: str, body: str, data: dict = None
    ):
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
                logger.warning("%d falhas ao enviar multicast.", response.failure_count)

            return response
        except Exception as e:
            logger.error("Erro ao enviar push multicast: %s", e)
            return None


notification_service = NotificationService()
