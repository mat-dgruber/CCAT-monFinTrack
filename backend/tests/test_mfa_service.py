import pytest
from unittest.mock import MagicMock, patch
from cryptography.fernet import Fernet
import os

# Set a dummy key for testing before importing the service
os.environ["MFA_ENCRYPTION_KEY"] = Fernet.generate_key().decode()

from app.services import mfa

@pytest.fixture
def mock_db():
    with patch("app.services.mfa.get_db") as mock:
        mock_firestore_client = MagicMock()
        mock.return_value = mock_firestore_client
        yield mock_firestore_client

def test_encryption_decryption(mock_db):
    secret = "JBSWY3DPEHPK3PXP"
    
    # Encrypt
    encrypted = mfa.mfa_service._encrypt_secret(secret)
    assert encrypted != secret
    
    # Decrypt
    decrypted = mfa.mfa_service._decrypt_secret(encrypted)
    assert decrypted == secret

def test_legacy_secret_compatibility(mock_db):
    # If the secret is not encrypted (legacy), it should return as is (if decryption fails)
    # Note: Fernet decryption raises InvalidToken. verify if my code catches it.
    # Code catch: except: return encrypted_secret
    
    legacy_secret = "JBSWY3DPEHPK3PXP" # Not a fernet token
    result = mfa.mfa_service._decrypt_secret(legacy_secret)
    assert result == legacy_secret

def test_enable_mfa_stores_encrypted(mock_db):
    user_id = "user1"
    secret = "JBSWY3DPEHPK3PXP"
    token = "123456"
    
    # Mock verify_token to return True
    with patch.object(mfa.mfa_service, 'verify_token', return_value=True):
        mfa.mfa_service.enable_mfa(user_id, secret, token)
        
        # Verify call to set
        mock_db.collection.return_value.document.return_value.set.assert_called_once()
        args = mock_db.collection.return_value.document.return_value.set.call_args[0][0]
        
        saved_secret = args['mfa_secret']
        assert saved_secret != secret # Should be encrypted
        assert mfa.mfa_service._decrypt_secret(saved_secret) == secret # Should be decryptable

def test_get_user_secret_decrypts(mock_db):
    user_id = "user1"
    secret = "JBSWY3DPEHPK3PXP"
    encrypted = mfa.mfa_service._encrypt_secret(secret)
    
    # Mock DB return
    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {"mfa_secret": encrypted}
    mock_db.collection.return_value.document.return_value.get.return_value = mock_doc
    
    retrieved = mfa.mfa_service.get_user_secret(user_id)
    assert retrieved == secret
