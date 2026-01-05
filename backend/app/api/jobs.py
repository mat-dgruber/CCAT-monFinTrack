
import os
from fastapi import APIRouter, HTTPException, Header, BackgroundTasks
from datetime import datetime, timedelta, timezone
from app.core.database import get_db
from app.services import transaction as transaction_service
from app.services.email_service import email_service
from app.services.notification_service import notification_service
from app.core import date_utils

router = APIRouter()

CRON_SECRET = os.getenv("CRON_SECRET", "super-secret-cron-key")

@router.post("/weekly-report")
async def trigger_weekly_report(
    background_tasks: BackgroundTasks,
    x_cron_secret: str = Header(None)
):
    """
    Endpoint chamado pelo Cron Job (GitHub Actions) toda semana.
    """
    if x_cron_secret != CRON_SECRET:
        raise HTTPException(status_code=401, detail="Invalid Cron Secret")

    # Iniciar processamento em background para não travar a request
    background_tasks.add_task(process_weekly_reports)
    
    return {"message": "Weekly report processing started"}

async def process_weekly_reports():
    print("🚀 Iniciando processamento de relatórios semanais...")
    db = get_db()
    users_ref = db.collection("users").stream()
    
    start_date = datetime.now(timezone.utc) - timedelta(days=7)
    end_date = datetime.now(timezone.utc)
    
    count = 0
    for user_doc in users_ref:
        user_data = user_doc.to_dict()
        user_id = user_doc.id
        email = user_data.get("email")
        name = user_data.get("name", "Usuário")
        
        # Verificar preferência do usuário (se existe flag para receber email)
        # Por padrão assumimos TRUE se não existir a chave
        # if not user_data.get("preferences", {}).get("email_reports", True):
        #     continue

        if not email:
            continue
            
        try:
            # 1. Buscar Transações da Semana
            transactions = transaction_service.list_transactions(
                user_id=user_id,
                start_date=start_date,
                end_date=end_date,
                limit=100
            )
            
            # 2. Calcular Totais
            income = 0.0
            expense = 0.0
            top_expenses = []
            
            for t in transactions:
                # Ignorar Fatura de Cartão (Pagamento) para não duplicar despesa se já conta os gastos
                # Mas aqui estamos vendo fluxo de caixa.
                # Se o usuário paga a fatura, sai dinheiro.
                # Se o usuário compra no cartão, cria dívida (não sai dinheiro na hora).
                # O MonFinTrack considera compra no cartão como despesa na data da compra?
                # Geralmente sim. Então o pagamento da fatura deve ser ignorado ou marcado como transferência.
                # Vamos assumir que "Fatura Cartão" é Transferência ou ignorar se tiver flag.
                
                # Simplificação: Somar tudo que é type=expense
                if t.type == "expense":
                    expense += t.amount
                    top_expenses.append(t)
                elif t.type == "income":
                    income += t.amount
            
            # Ordenar maiores gastos
            top_expenses.sort(key=lambda x: x.amount, reverse=True)
            top_5_expenses = top_expenses[:5]
            
            # Saldo Atual (Total)
            all_accounts = db.collection("accounts").where("user_id", "==", user_id).stream()
            total_balance = sum(acc.to_dict().get("balance", 0) for acc in all_accounts)
            
            # Montar Dados
            report_data = {
                "income_total": f"{income:.2f}".replace('.', ','),
                "expense_total": f"{expense:.2f}".replace('.', ','),
                "balance": f"{total_balance:.2f}".replace('.', ','),
                "top_expenses": [
                    {"description": t.description, "amount": f"{t.amount:.2f}".replace('.', ',')} 
                    for t in top_5_expenses
                ],
                "alerts": []
            }
            
            # Gerar Alertas Simples
            if expense > income:
                report_data["alerts"].append("⚠️ Seus gastos superaram seus ganhos esta semana.")
            
            if total_balance < 0:
                 report_data["alerts"].append("⚠️ Sua conta está no vermelho.")

            # Enviar Email
            if income > 0 or expense > 0: # Só envia se teve movimentação
                await email_service.send_weekly_report(email, name, report_data)
                
                # Enviar Push Notification
                fcm_tokens = user_data.get("fcm_tokens", [])
                if fcm_tokens and isinstance(fcm_tokens, list):
                    notification_service.send_multicast(
                        tokens=fcm_tokens,
                        title="📊 Resumo Semanal Pronto",
                        body=f"Seu saldo da semana é R$ {report_data['balance']}. Toque para ver detalhes.",
                        data={"url": "/dashboard"}
                    )

                count += 1
                
        except Exception as e:
            print(f"❌ Erro ao processar relatório para {email}: {e}")
            
    print(f"✅ Relatórios semanais enviados: {count}")
