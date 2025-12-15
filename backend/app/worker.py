import asyncio
from datetime import datetime, timezone
from app.services import recurrence as recurrence_service
from app.services import transaction as transaction_service
from app.schemas.transaction import TransactionCreate, TransactionType, PaymentMethod, TransactionStatus
from app.core.database import get_db
from app.core.date_utils import calculate_next_due_date
from google.cloud import firestore

# Configuração do Logger (simples print por enquanto)
def log(msg):
    print(f"[{datetime.now()}] {msg}")

async def process_recurrences():
    log("🤖 Iniciando o Matador de Preguiça (Recurrence Worker)...")
    db = get_db()
    
    # 1. Buscar todas as recorrências ativas
    recurrences_ref = db.collection("recurrences").where("active", "==", True)
    active_recurrences = recurrences_ref.stream()
    
    count = 0
    processed = 0
    
    for doc in active_recurrences:
        count += 1
        rec_data = doc.to_dict()
        rec_id = doc.id
        user_id = rec_data.get("user_id")
        
        if not user_id:
            continue
            
        # Calcular Próximo Vencimento
        last_processed = rec_data.get("last_processed_at")
        due_day = rec_data.get("due_day", 1)
        periodicity = rec_data.get("periodicity")
        
        today = datetime.now(timezone.utc).replace(tzinfo=None)
        
        # Normalizando datas
        if last_processed:
            if isinstance(last_processed, str):
                last_processed = datetime.fromisoformat(last_processed.replace('Z', '+00:00'))
            if last_processed.tzinfo:
                last_processed = last_processed.replace(tzinfo=None)
                
            next_due = calculate_next_due_date(last_processed, periodicity)
            
            try:
                next_due = next_due.replace(day=due_day)
            except ValueError:
                pass
                
        else:
            # Primeira vez
            next_due = today.replace(day=due_day)
            if next_due > today:
                continue
        
        # VERIFICAÇÃO: Hoje >= Data Próximo Vencimento
        if today >= next_due:
            # Check if this date is skipped
            skipped_dates = rec_data.get("skipped_dates", [])
            # Convert skipped_dates strings to date objects if needed
            is_skipped = False
            next_due_date = next_due.date()
            
            for sd in skipped_dates:
                if isinstance(sd, str):
                    try:
                        if 'T' in sd:
                            sd_date = datetime.fromisoformat(sd.replace('Z', '+00:00')).date()
                        else:
                            sd_date = datetime.fromisoformat(sd).date()
                    except:
                        continue
                else:
                    sd_date = sd
                
                if sd_date == next_due_date:
                    is_skipped = True
                    break
            
            if is_skipped:
                log(f"⏭️ Pulando ocorrência {rec_data.get('name')} ({next_due.strftime('%d/%m/%Y')}) - Usuário solicitou exclusão.")
                # Update last_processed_at so it moves to next period
                db.collection("recurrences").document(rec_id).update({
                    "last_processed_at": next_due
                })
                continue

            log(f"🔄 Processando recorrência {rec_data.get('name')} para User {user_id}")
            
            # Criar Transação SEMPRE como PENDENTE inicialmente
            # O processamento de auto-pay será feito na etapa 2
            
            # Recorrência agora pode ter TYPE (Default: EXPENSE)
            rec_type = rec_data.get("type", TransactionType.EXPENSE)
            description = f"{rec_data.get('name')} ({next_due.strftime('%m/%Y')})"
            
            # Lógica Especial para TRANSFER (Pagamento de Fatura)
            if rec_type == TransactionType.TRANSFER and rec_data.get("credit_card_id"):
                cc_id = rec_data.get("credit_card_id")
                # Gerar Chave de Referência para evitar duplicidade
                # REF:{card_id}:{month}:{year}
                # next_due é a data de vencimento da recorrência. 
                # Assumimos que a fatura refere-se ao mês de vencimento OU anterior.
                # Simplificação: Usar mês/ano do vencimento da recorrência como referência da fatura.
                ref_key = f"REF:{cc_id}:{next_due.month}:{next_due.year}"
                description = f"{description} | {ref_key}"

            new_transaction = TransactionCreate(
                description=description,
                amount=rec_data.get("amount"),
                date=next_due,
                type=rec_type, 
                payment_method=PaymentMethod.OTHER, 
                category_id=rec_data.get("category_id"),
                account_id=rec_data.get("account_id"),
                recurrence_id=rec_id,
                status=TransactionStatus.PENDING,
                is_auto_pay=rec_data.get("auto_pay", False)
            )
            
            if rec_data.get("payment_method_id"):
                 new_transaction.payment_method = rec_data.get("payment_method_id")
            
            if rec_data.get("credit_card_id"):
                 new_transaction.credit_card_id = rec_data.get("credit_card_id")
            
            try:
                transaction_service.create_transaction(new_transaction, user_id)
                
                # Atualizar Recorrência
                db.collection("recurrences").document(rec_id).update({
                    "last_processed_at": datetime.now()
                })
                processed += 1
            except Exception as e:
                log(f"❌ Erro ao processar {rec_id}: {e}")

    # 2. Processar Pagamentos Automáticos Pendentes
    log("🔄 Verificando pagamentos automáticos pendentes...")
    
    # Query: Status=PENDING, is_auto_pay=True, date <= Today
    # Nota: Firestore requer índice composto para múltiplas igualdades e desigualdades.
    # Vamos filtrar por status e auto_pay, e verificar data em memória se o volume for baixo.
    # Ou melhor: filtrar por status=PENDING e iterar.
    
    pending_query = db.collection("transactions")\
        .where("status", "==", TransactionStatus.PENDING)\
        .where("is_auto_pay", "==", True)\
        .stream()
        
    auto_pay_count = 0
    today_naive = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    for t in pending_query:
        t_data = t.to_dict()
        t_id = t.id
        t_user_id = t_data.get("user_id")
        t_date = t_data.get("date")
        
        if not t_user_id:
            continue
            
        # Normaliza data da transação
        if isinstance(t_date, str):
            try:
                t_date = datetime.fromisoformat(t_date.replace('Z', '+00:00'))
            except:
                continue
        
        if t_date.tzinfo:
            t_date = t_date.replace(tzinfo=None)
            
        # Zera hora para comparar apenas dia
        t_date = t_date.replace(hour=0, minute=0, second=0, microsecond=0)
        
        if t_date <= today_naive:
            log(f"💰 Efetuando pagamento automático: {t_data.get('description')}")
            
            # Atualiza para PAGO
            # Precisamos usar o service update_transaction para garantir que o saldo seja atualizado!
            
            # Recria o objeto TransactionCreate com os dados atuais + status PAGO
            # Nota: update_transaction espera um TransactionCreate completo ou parcial?
            # O service update_transaction faz: data = transaction_in.model_dump()... doc_ref.set(data)
            # Ele faz SET, ou seja, substitui tudo! Precisamos passar todos os dados.
            
            # Melhor abordagem: Ler, alterar status, chamar update.
            
            try:
                # Constrói objeto de atualização
                # Precisamos mapear os campos do dict para o schema
                # Isso pode ser chato se o schema for rigoroso.
                # Vamos tentar instanciar TransactionCreate com **t_data
                
                t_data['status'] = TransactionStatus.PAID
                t_data['payment_date'] = datetime.now()
                
                # Remove campos que não estão no TransactionCreate (ex: id, created_at se houver)
                t_data.pop('id', None)
                t_data.pop('user_id', None) # O service recoloca
                
                # Converte strings de enum de volta se necessário, mas Pydantic deve lidar se forem strings válidas.
                
                update_payload = TransactionCreate(**t_data)
                
                transaction_service.update_transaction(t_id, update_payload, t_user_id)
                auto_pay_count += 1
                
            except Exception as e:
                log(f"❌ Erro ao pagar {t_id}: {e}")

    log(f"✅ Finalizado. Recorrências geradas: {processed}. Pagamentos automáticos: {auto_pay_count}.")

if __name__ == "__main__":
    # Para rodar localmente
    asyncio.run(process_recurrences())
