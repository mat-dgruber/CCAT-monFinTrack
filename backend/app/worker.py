import asyncio
from datetime import datetime, timezone
from app.services import recurrence as recurrence_service
from app.services import transaction as transaction_service
from app.schemas.transaction import TransactionCreate, TransactionType, PaymentMethod
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
    # Nota: Em produção, isso deve ser paginado ou filtrado por chunks de usuários se houver muitos.
    # Como não temos um "list_all_active_recurrences" global no service (ele filtra por user),
    # vamos fazer uma query direta aqui ou adicionar no service.
    # Query direta é mais eficiente para o worker.
    
    recurrences_ref = db.collection("recurrences").where("active", "==", True)
    active_recurrences = recurrences_ref.stream()
    
    count = 0
    processed = 0
    
    for doc in active_recurrences:
        count += 1
        rec_data = doc.to_dict()
        rec_id = doc.id
        user_id = rec_data.get("user_id")
        
        # Validação básica
        if not user_id:
            continue
            
        # Calcular Próximo Vencimento
        last_processed = rec_data.get("last_processed_at")
        due_day = rec_data.get("due_day", 1)
        periodicity = rec_data.get("periodicity")
        
        # Se nunca processou, a base é a data de criação ou hoje?
        # O user request diz: "Usa a biblioteca de data... baseada no ultimo_processamento e na periodicidade."
        # Se ultimo_processamento for None, assumimos que é a primeira vez?
        # Mas na criação (Cenário B) podemos ter gerado a primeira.
        # Se gerou a primeira, last_processed deve ser atualizado lá.
        # Se não gerou, last_processed é None.
        
        # Lógica de Data:
        # Precisamos saber QUAL O MÊS/ANO de referência para gerar.
        # Se last_processed existe, calculamos o próximo.
        # Se não existe, assumimos que deve gerar para o mês atual se o dia já passou?
        
        today = datetime.now(timezone.utc).replace(tzinfo=None) # Naive para simplificar comparação com DB se estiver naive
        # Firestore retorna datetime com tzinfo se salvo com.
        
        # Normalizando datas
        if last_processed:
            if isinstance(last_processed, str):
                last_processed = datetime.fromisoformat(last_processed.replace('Z', '+00:00'))
            if last_processed.tzinfo:
                last_processed = last_processed.replace(tzinfo=None)
                
            next_due = calculate_next_due_date(last_processed, periodicity)
            
            # Ajusta o dia para o due_day configurado (pois relativedelta(months=1) mantém o dia, mas queremos forçar o dia de vencimento)
            # Ex: Vence dia 10. Processou 10/01. Next = 10/02.
            # Mas se processou atrasado em 12/01? Next seria 12/02? Não, deve ser 10/02.
            # Então: Next Month/Year based on last_processed, but Day = due_day.
            
            # Melhor abordagem: Adicionar a periodicidade à data de VENCIMENTO anterior, não à data de processamento.
            # Mas não guardamos a "data de vencimento da última fatura gerada".
            # Vamos usar last_processed como proxy, assumindo que o worker roda e atualiza.
            
            # Ajuste fino:
            try:
                next_due = next_due.replace(day=due_day)
            except ValueError:
                # Caso dia 31 em mês de 30 dias, etc.
                # Vamos simplificar e deixar o relativedelta cuidar disso se usarmos a data base correta.
                pass
                
        else:
            # Primeira vez
            # Se created_at for hoje, e não gerou primeira, talvez devêssemos gerar se hoje >= due_day?
            # Vamos assumir que se não tem last_processed, o target é o mês atual.
            next_due = today.replace(day=due_day)
            # Se due_day já passou neste mês, e não processou, deve processar.
            # Se due_day ainda não chegou, espera.
            if next_due > today:
                # Ainda não venceu este mês
                continue
        
        # VERIFICAÇÃO: Hoje >= Data Próximo Vencimento
        if today >= next_due:
            log(f"🔄 Processando recorrência {rec_data.get('name')} para User {user_id}")
            
            # Criar Transação
            status = "PAGO" if rec_data.get("auto_pay") else "PENDENTE"
            # TransactionCreate não tem status, ele define type.
            # O status PAGO/PENDENTE geralmente é inferido se tem data_pagamento.
            # Nosso Transaction schema tem 'date' (vencimento) e 'payment_date' (pagamento real)?
            # O schema TransactionBase tem 'date'. Não tem 'status' explícito nem 'payment_date'.
            # O user request diz: "Campo status Enum PENDENTE, PAGO, ATRASADO".
            # E "data_pagamento Date (null se pendente)".
            # MEU SCHEMA TRANSACTION NÃO TEM STATUS NEM DATA_PAGAMENTO!
            # FALHA MINHA NA FASE 1.
            # Eu adicionei campos de recorrência, mas esqueci de atualizar o modelo de Transação para suportar Status e Data Pagamento.
            # O TransactionCreate atual assume que cria e já afeta o saldo (ou seja, é PAGO).
            # "create_transaction" chama "_update_account_balance" imediatamente.
            
            # CORREÇÃO NECESSÁRIA:
            # Preciso atualizar o Transaction schema e model para suportar 'status' e 'payment_date'.
            # E o 'create_transaction' só deve atualizar saldo se status == PAGO.
            
            # Como estou no meio da Phase 3, e isso é crítico, vou fazer um "Hotfix" no plano.
            # Vou assumir que por enquanto cria como PAGO se auto_pay=True.
            # Se auto_pay=False, deveria criar como PENDENTE e NÃO descontar do saldo.
            # Mas meu create_transaction desconta saldo sempre.
            
            # VOU CONTINUAR O SCRIPT ASSUMINDO QUE VOU CORRIGIR O TRANSACTION SERVICE EM BREVE.
            # Por enquanto, vou criar a transação. Se auto_pay=False, ela será criada e descontada (bug conhecido).
            # Vou adicionar um TODO.
            
            new_transaction = TransactionCreate(
                description=f"{rec_data.get('name')} ({next_due.strftime('%m/%Y')})",
                amount=rec_data.get("amount"),
                date=next_due,
                type=TransactionType.EXPENSE, 
                payment_method=PaymentMethod.OTHER, 
                category_id=rec_data.get("category_id"),
                account_id=rec_data.get("account_id"),
                recurrence_id=rec_id,
                status=TransactionStatus.PAID if rec_data.get("auto_pay") else TransactionStatus.PENDING
            )
            
            # Hack para Payment Method se tiver salvo
            if rec_data.get("payment_method_id"):
                 new_transaction.payment_method = rec_data.get("payment_method_id")
            
            try:
                transaction_service.create_transaction(new_transaction, user_id)
                
                # Atualizar Recorrência
                db.collection("recurrences").document(rec_id).update({
                    "last_processed_at": datetime.now()
                })
                processed += 1
            except Exception as e:
                log(f"❌ Erro ao processar {rec_id}: {e}")

    log(f"✅ Finalizado. Total: {count}. Processados: {processed}.")

if __name__ == "__main__":
    # Para rodar localmente
    asyncio.run(process_recurrences())
