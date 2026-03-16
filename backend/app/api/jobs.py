import os
from datetime import datetime, timedelta, timezone

from app.core.database import get_db
from app.core.logger import get_logger
from app.services import ai_service
from app.services import transaction as transaction_service
from app.services.email_service import email_service
from app.services.notification_service import notification_service
from fastapi import APIRouter, Header, HTTPException

logger = get_logger(__name__)

router = APIRouter()

CRON_SECRET = os.getenv("CRON_SECRET", "super-secret-cron-key")


@router.post("/weekly-report")
async def trigger_weekly_report(x_cron_secret: str = Header(None)):
    """
    Endpoint chamado pelo Cron Job (GitHub Actions) toda semana.
    """
    if x_cron_secret != CRON_SECRET:
        raise HTTPException(status_code=401, detail="Invalid Cron Secret")

    # Executar imediatamente de forma síncrona para que ambientes Serverless
    # não pausem a CPU enquanto os envios acontecem em background.
    await process_weekly_reports()

    return {"message": "Weekly report processing completed"}


async def process_weekly_reports():
    logger.info("Iniciando processamento de relatórios semanais...")
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
                user_id=user_id, start_date=start_date, end_date=end_date, limit=100
            )

            # 2. Calcular Totais e Categorias
            income = 0.0
            expense = 0.0
            top_expenses = []
            category_totals = {}

            for t in transactions:
                if t.type == "expense":
                    expense += t.amount
                    top_expenses.append(t)

                    cat_name = t.category.name if t.category else "Outros"
                    category_totals[cat_name] = (
                        category_totals.get(cat_name, 0) + t.amount
                    )
                elif t.type == "income":
                    income += t.amount

            top_expenses.sort(key=lambda x: x.amount, reverse=True)
            top_5_expenses = top_expenses[:5]

            sorted_categories = sorted(
                category_totals.items(), key=lambda x: x[1], reverse=True
            )
            category_breakdown = [
                {"name": name, "amount": f"{amt:.2f}".replace(".", ",")}
                for name, amt in sorted_categories[:5]
            ]

            # Saldo Atual (Total)
            all_accounts = (
                db.collection("accounts").where("user_id", "==", user_id).stream()
            )
            total_balance = sum(acc.to_dict().get("balance", 0) for acc in all_accounts)

            # 3. Gerar Insights de IA
            period_str = (
                f"{start_date.strftime('%d %b')} - {end_date.strftime('%d %b')}"
            )
            insight_data = {
                "income": income,
                "expense": expense,
                "balance": total_balance,
                "top_categories": [
                    {"name": name, "amount": amt} for name, amt in sorted_categories[:3]
                ],
                "period": period_str,
            }

            try:
                ai_insight = await ai_service.generate_weekly_insights(
                    user_id, insight_data
                )
            except Exception as e:
                logger.error("Weekly Insights Error for user %s: %s", user_id, e)
                ai_insight = "Continue focado em seus objetivos financeiros! A consistência é o segredo do sucesso."

            # Montar Dados
            report_data = {
                "period": period_str,
                "income_total": f"{income:.2f}".replace(".", ","),
                "expense_total": f"{expense:.2f}".replace(".", ","),
                "balance": f"{total_balance:.2f}".replace(".", ","),
                "top_expenses": [
                    {
                        "description": t.description,
                        "amount": f"{t.amount:.2f}".replace(".", ","),
                    }
                    for t in top_5_expenses
                ],
                "category_breakdown": category_breakdown,
                "ai_insight": ai_insight,
                "alerts": [],
            }

            # Gerar Alertas Simples
            if expense > income:
                report_data["alerts"].append(
                    "⚠️ Seus gastos superaram seus ganhos esta semana."
                )

            if total_balance < 0:
                report_data["alerts"].append("⚠️ Sua conta está no vermelho.")

            # Enviar Email
            if income > 0 or expense > 0:  # Só envia se teve movimentação
                await email_service.send_weekly_report(email, name, report_data)

                # Enviar Push Notification
                fcm_tokens = user_data.get("fcm_tokens", [])
                if fcm_tokens and isinstance(fcm_tokens, list):
                    notification_service.send_multicast(
                        tokens=fcm_tokens,
                        title="📊 Resumo Semanal Pronto",
                        body=f"Seu saldo da semana é R$ {report_data['balance']}. Toque para ver detalhes.",
                        data={"url": "/dashboard"},
                    )

                count += 1
                logger.debug("Relatório enviado e push notificado para %s", email)

        except Exception as e:
            logger.error("Erro ao processar relatório para %s: %s", email, e)
            continue  # Garante que o loop não pare por conta do erro neste usuário

    logger.info("Relatórios semanais enviados com sucesso para %d usuários.", count)
