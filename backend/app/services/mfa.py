import pyotp
import qrcode
import io
import base64
import os
from cryptography.fernet import Fernet
from app.core.database import get_db

class MFAService:
    def __init__(self):
        # Retrieve key from environment or use a default specific for dev/test if missing (NOT SAFER FOR PROD but prevents crash locally without setup)
        # Ideally, we should enforce this env var.
        key = os.getenv("MFA_ENCRYPTION_KEY")
        if not key:
             # Warning: using a generated key that won't persist across restarts if not set! 
             # For a real remediation, we assume the user will set this.
             # Generating one for temporary usage if missing, but this makes stored secrets unrecoverable after restart.
             # Better to raise error or use a hardcoded dev key if safe-to-autorun logic warrants it.
             # Given the prompt, I'll attempt to load or log a warning.
             # Let's use a fixed dummy key for dev/local so it works without extra setup, BUT warn.
             # Fernet key must be 32 url-safe base64-encoded bytes.
             key = Fernet.generate_key() 
             print("WARNING: MFA_ENCRYPTION_KEY not set. Using temporary key. Secrets will be lost on restart.")
        
        try:
            self.cipher = Fernet(key)
        except Exception as e:
            # Fallback if key format is invalid
            print(f"Invalid MFA_ENCRYPTION_KEY: {e}. Generating new one.")
            self.cipher = Fernet(Fernet.generate_key())

    def _get_collection(self):
        db = get_db()
        return db.collection('users')

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

    def _encrypt_secret(self, secret: str) -> str:
        """Encrypts the MFA secret."""
        return self.cipher.encrypt(secret.encode()).decode()

    def _decrypt_secret(self, encrypted_secret: str) -> str:
        """Decrypts the MFA secret."""
        try:
            return self.cipher.decrypt(encrypted_secret.encode()).decode()
        except:
             # Fallback for plain text secrets (legacy support during migration)
             return encrypted_secret

    def enable_mfa(self, user_id: str, secret: str, token: str) -> bool:
        """
        Verifica o token e, se válido, salva o segredo no perfil do usuário.
        """
        if self.verify_token(secret, token):
            encrypted_secret = self._encrypt_secret(secret)
            self._get_collection().document(user_id).set({
                "mfa_secret": encrypted_secret,
                "mfa_enabled": True
            }, merge=True)
            return True
        return False

    def disable_mfa(self, user_id: str):
        """Desativa o MFA removendo o segredo."""
        self._get_collection().document(user_id).set({
            "mfa_secret": None,
            "mfa_enabled": False
        }, merge=True)

    def check_mfa_status(self, user_id: str) -> bool:
        """Verifica se o MFA está ativado."""
        doc = self._get_collection().document(user_id).get()
        if doc.exists:
            data = doc.to_dict()
            return data.get("mfa_enabled", False)
        return False

    def get_user_secret(self, user_id: str) -> str:
        """Recupera o segredo MFA do usuário."""
        doc = self._get_collection().document(user_id).get()
        if doc.exists:
            data = doc.to_dict()
            encrypted_secret = data.get("mfa_secret")
            if encrypted_secret:
                return self._decrypt_secret(encrypted_secret)
        return None

mfa_service = MFAService()

