
import asyncio
import os
import sys

# Adiciona o diretório pai ao path para importar app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from app.services.email_service import email_service
from app.services.notification_service import notification_service

async def test_email():
    print("\n📧 --- Teste de Email ---")
    dest = input("Digite um email para teste (Enter para pular): ")
    if not dest:
        print("Pulado.")
        return

    print("Enviando...")
    try:
        await email_service.send_weekly_report(
            recipient_email=dest,
            recipient_name="Testador",
            report_data={
                "income_total": "100,00",
                "expense_total": "50,00",
                "balance": "50,00",
                "top_expenses": [{"description": "Gasto Teste", "amount": "50,00"}],
                "alerts": ["Isso é um alerta de teste."]
            }
        )
        print("✅ Email enviado com sucesso! Verifique sua caixa de entrada.")
    except Exception as e:
        print(f"❌ Erro ao enviar email: {e}")
        print("Dica: Verifique MAIL_USERNAME e MAIL_PASSWORD no .env e se 'Senha de App' foi usada.")

def test_push():
    print("\n🔔 --- Teste de Push Notification ---")
    token = input("Digite um FCM Token para teste (Enter para pular): ")
    if not token:
        print("Pulado. (Tip: Pegue o token no console do navegador após permitir notificações)")
        return

    print("Enviando...")
    try:
        response = notification_service.send_to_token(
            token=token,
            title="Teste de Push",
            body="Funciona! 🚀"
        )
        print(f"✅ Push enviado! Response: {response}")
    except Exception as e:
        print(f"❌ Erro ao enviar push: {e}")

async def main():
    print("🛠️  Script de Teste de Notificações - MonFinTrack")
    
    await test_email()
    test_push()

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
