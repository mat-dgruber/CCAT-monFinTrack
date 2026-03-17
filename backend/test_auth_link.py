import os
import sys

from firebase_admin import auth

# Adicionar o diretório atual ao path para importar app
sys.path.append(os.getcwd())

from app.core.database import get_db


def test_firebase_auth():
    print("Iniciando teste de Firebase Auth...")
    try:
        # Garante inicialização
        get_db()

        email = "matheus.diniz_1@hotmail.com"  # Email que deu erro
        print(f"Tentando buscar usuário: {email}")

        try:
            user = auth.get_user_by_email(email)
            print(f"Usuário encontrado: {user.uid}")

            print("Tentando gerar link de verificação...")
            action_code_settings = auth.ActionCodeSettings(
                url="https://monfintrack.com.br/verify-email",
                handle_code_in_app=True,
            )
            link = auth.generate_email_verification_link(email, action_code_settings)
            print(f"Link gerado com sucesso: {link[:50]}...")

        except auth.UserNotFoundError:
            print(
                "Usuário não encontrado no Firebase. Testando com um email inexistente para validar conexão..."
            )
            # Se deu UserNotFoundError, a conexão está OK, o usuário que sumiu
        except Exception as e:
            print(f"Erro ao interagir com Auth: {e}")

    except Exception as e:
        print(f"Erro na inicialização: {e}")


if __name__ == "__main__":
    test_firebase_auth()
