import pyotp
import qrcode
import io
import base64
from app.core.database import get_db

class MFAService:
    def __init__(self):
        self.db = get_db()
        self.collection = self.db.collection('users')

    def generate_secret(self) -> str:
        """Gera um segredo aleatório base32."""
        return pyotp.random_base32()

    def generate_qr_code(self, secret: str, email: str) -> str:
        """
        Gera um QR Code para o Google Authenticator.
        Retorna a imagem em base64.
        """
        totp = pyotp.TOTP(secret)
        provisioning_uri = totp.provisioning_uri(name=email, issuer_name="MonFinTrack")

        # Gerar imagem QR Code
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(provisioning_uri)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")
        
        # Converter para base64
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
        return f"data:image/png;base64,{img_str}"

    def verify_token(self, secret: str, token: str) -> bool:
        """Verifica se o token TOTP é válido para o segredo."""
        totp = pyotp.TOTP(secret)
        return totp.verify(token)

    def enable_mfa(self, user_id: str, secret: str, token: str) -> bool:
        """
        Verifica o token e, se válido, salva o segredo no perfil do usuário.
        """
        if self.verify_token(secret, token):
            self.collection.document(user_id).set({
                "mfa_secret": secret,
                "mfa_enabled": True
            }, merge=True)
            return True
        return False

    def disable_mfa(self, user_id: str):
        """Desativa o MFA removendo o segredo."""
        self.collection.document(user_id).set({
            "mfa_secret": None,
            "mfa_enabled": False
        }, merge=True)

    def check_mfa_status(self, user_id: str) -> bool:
        """Verifica se o MFA está ativado."""
        doc = self.collection.document(user_id).get()
        if doc.exists:
            data = doc.to_dict()
            return data.get("mfa_enabled", False)
        return False

    def get_user_secret(self, user_id: str) -> str:
        """Recupera o segredo MFA do usuário."""
        doc = self.collection.document(user_id).get()
        if doc.exists:
            data = doc.to_dict()
            return data.get("mfa_secret")
        return None

mfa_service = MFAService()
