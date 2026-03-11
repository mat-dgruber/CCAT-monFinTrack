import os
from pathlib import Path

from app.core.logger import get_logger
from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType
from jinja2 import Environment, FileSystemLoader, select_autoescape

logger = get_logger(__name__)


# Configurações do Email
class EmailService:
    def __init__(self):
        self.mail_username = os.getenv("MAIL_USERNAME")
        self.mail_password = os.getenv("MAIL_PASSWORD")
        self.mail_from = os.getenv("MAIL_FROM", self.mail_username)
        self.mail_from_name = os.getenv("MAIL_FROM_NAME", "MonFinTrack")
        self.mail_port = int(os.getenv("MAIL_PORT", 587))
        self.mail_server = os.getenv("MAIL_SERVER", "smtp.gmail.com")
        self.mail_ssl_tls = os.getenv("MAIL_SSL_TLS", "False").lower() == "true"
        self.mail_starttls = os.getenv("MAIL_STARTTLS", "True").lower() == "true"

        try:
            self.conf = ConnectionConfig(
                MAIL_USERNAME=self.mail_username,
                MAIL_PASSWORD=self.mail_password,
                MAIL_FROM=self.mail_from,
                MAIL_FROM_NAME=self.mail_from_name,
                MAIL_PORT=self.mail_port,
                MAIL_SERVER=self.mail_server,
                MAIL_STARTTLS=self.mail_starttls,
                MAIL_SSL_TLS=self.mail_ssl_tls,
                USE_CREDENTIALS=True,
                VALIDATE_CERTS=True,
            )
            self.enabled = True
        except Exception as e:
            logger.warning("EmailService disabled due to missing config: %s", e)
            self.conf = None
            self.enabled = False

        # Configuração do Template
        template_dir = Path(__file__).parent.parent / "templates"
        self.env = Environment(
            loader=FileSystemLoader(str(template_dir)),
            autoescape=select_autoescape(["html", "xml"]),
        )

    async def send_email(
        self,
        subject: str,
        recipients: list[str],
        body: str,
        subtype: MessageType = MessageType.html,
    ):
        if not self.enabled or not self.conf:
            logger.info(
                "Email skipped (service disabled): %s -> %s", subject, recipients
            )
            return

        message = MessageSchema(
            subject=subject, recipients=recipients, body=body, subtype=subtype
        )

        fm = FastMail(self.conf)
        await fm.send_message(message)

    def render_template(self, template_name: str, context: dict) -> str:
        template = self.env.get_template(template_name)
        return template.render(context)

    async def send_weekly_report(
        self, recipient_email: str, recipient_name: str, report_data: dict
    ):
        """
        Envia o relatório semanal para o usuário.
        """
        html_content = self.render_template(
            "weekly_report.html",
            {
                "name": recipient_name,
                "data": report_data,
                "logo_url": "https://monfintrack.com.br/assets/logo-ccat.png",
            },
        )

        await self.send_email(
            subject="📊 Seu Resumo Financeiro Semanal - MonFinTrack",
            recipients=[recipient_email],
            body=html_content,
        )


email_service = EmailService()
