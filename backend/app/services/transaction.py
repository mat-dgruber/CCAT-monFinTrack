import uuid
from datetime import datetime, timezone
from typing import List, Optional

from app.core.database import get_db
from app.core.date_utils import get_month_range
from app.core.logger import get_logger
from app.schemas.account import Account
from app.schemas.category import Category
from app.schemas.recurrence import RecurrenceCreate, RecurrencePeriodicity
from app.schemas.transaction import (
    Transaction,
    TransactionCreate,
    TransactionStatus,
    TransactionType,
    TransactionUpdate,
)
from app.services import account as account_service
from app.services import category as category_service
from app.services import recurrence as recurrence_service
from app.services.analysis_service import analysis_service
from dateutil.relativedelta import relativedelta
from fastapi import HTTPException
from google.cloud import firestore
from google.cloud.firestore_v1 import FieldFilter

logger = get_logger(__name__)
COLLECTION_NAME = "transactions"


# Função Auxiliar Blindada
def _update_account_balance(
    db,
    account_id: str,
    amount: float,
    type: str,
    user_id: str,
    revert: bool = False,
    destination_account_id: str = None,
):
    if not account_id:
        return

    # SOURCE ACCOUNT
    acc_ref = db.collection("accounts").document(account_id)
    acc_doc = acc_ref.get()

    if acc_doc.exists and acc_doc.to_dict().get("user_id") == user_id:
        current_balance = acc_doc.to_dict().get("balance", 0.0)

        # LOGIC FOR SOURCE ACCOUNT
        if type == "expense":
            if revert:
                current_balance += amount
            else:
                current_balance -= amount
        elif type == "income":
            if revert:
                current_balance -= amount
            else:
                current_balance += amount
        elif type == "transfer":
            # Transfers always decrement source, unless reverting
            if revert:
                current_balance += amount
            else:
                current_balance -= amount

        acc_ref.update({"balance": current_balance})
    else:
        logger.warning(
            "Acesso negado ou conta inexistente para update de saldo. User: %s, Acc: %s",
            user_id,
            account_id,
        )

    # DESTINATION ACCOUNT (Only for Transfers with explicit destination)
    if type == "transfer" and destination_account_id:
        dest_ref = db.collection("accounts").document(destination_account_id)
        dest_doc = dest_ref.get()

        if dest_doc.exists and dest_doc.to_dict().get("user_id") == user_id:
            dest_balance = dest_doc.to_dict().get("balance", 0.0)

            if revert:
                dest_balance -= amount  # Reverting transfer: Remove from dest
            else:
                dest_balance += amount  # Applying transfer: Add to dest

            dest_ref.update({"balance": dest_balance})
        else:
            logger.warning(
                "Acesso negado ou conta destino inexistente. User: %s, DestAcc: %s",
                user_id,
                destination_account_id,
            )


def create_transaction(transaction_in: TransactionCreate, user_id: str) -> Transaction:
    db = get_db()

    category = category_service.get_category(transaction_in.category_id, user_id)
    # Aqui também seria ideal verificar se a categoria é do usuário
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    account = account_service.get_account(transaction_in.account_id, user_id)

    destination_account = None
    if transaction_in.destination_account_id:
        destination_account = account_service.get_account(
            transaction_in.destination_account_id, user_id
        )

    # Atualiza Saldo (Passando user_id para segurança) - APENAS SE PAGO E NÃO FOR CARTÃO DE CRÉDITO
    if (
        transaction_in.status == TransactionStatus.PAID
        and not transaction_in.credit_card_id
    ):
        _update_account_balance(
            db,
            transaction_in.account_id,
            transaction_in.amount,
            transaction_in.type,
            user_id,
            revert=False,
            destination_account_id=transaction_in.destination_account_id,
        )

    # --- ANOMALY DETECTION (PRO) ---
    if transaction_in.type == TransactionType.EXPENSE and not transaction_in.warning:
        warning = analysis_service.analyze_transaction(
            user_id, transaction_in.amount, transaction_in.category_id
        )
        if warning:
            transaction_in.warning = warning
    # -------------------------------

    data = transaction_in.model_dump()
    data["user_id"] = user_id  # MARCA DONO

    update_time, transaction_ref = db.collection(COLLECTION_NAME).add(data)

    return Transaction(
        id=transaction_ref.id,
        category=category,
        account=account,
        destination_account=destination_account,
        **data,
    )


def create_unified_transaction(
    transaction_in: TransactionCreate, user_id: str
) -> List[Transaction]:
    """
    Cria transações unificadas: Simples, Parceladas ou Recorrentes.
    Retorna uma lista de transações criadas (pode ser 1 ou várias).
    """
    created_transactions = []

    # Lógica de Parcelamento (Cenário A)
    if transaction_in.total_installments and transaction_in.total_installments > 1:
        group_id = str(uuid.uuid4())

        base_date = transaction_in.date
        # Ensure base_date is datetime
        if not isinstance(base_date, datetime):
            base_date = datetime.combine(base_date, datetime.min.time())

        for i in range(transaction_in.total_installments):
            # Calculate due date: base_date + i months
            due_date = base_date + relativedelta(months=i)

            # Prepare data
            t_data = transaction_in.model_dump()
            t_data["installment_group_id"] = group_id
            t_data["installment_number"] = i + 1
            t_data["date"] = due_date

            # FIX: Limpar campos de dízimo para DESPESAS (dízimo só se aplica a receitas)
            if transaction_in.type != TransactionType.INCOME:
                t_data["tithe_amount"] = None
                t_data["tithe_percentage"] = None
                t_data["tithe_status"] = None
                t_data["offering_amount"] = None
                t_data["offering_percentage"] = None
                t_data["net_amount"] = None
                t_data["gross_amount"] = None

            # Status Logic
            if i == 0:
                pass
            else:
                t_data["status"] = TransactionStatus.PENDING
                t_data["is_paid"] = False
                t_data["payment_date"] = None
                if (
                    transaction_in.type == TransactionType.INCOME
                    and "tithe_status" in t_data
                ):
                    t_data["tithe_status"] = (
                        "PENDING" if t_data.get("tithe_status") != "NONE" else "NONE"
                    )

            original_title = transaction_in.title
            t_data["description"] = (
                f"{original_title} ({i+1}/{transaction_in.total_installments})"
            )
            t_data["title"] = (
                f"{original_title} ({i+1}/{transaction_in.total_installments})"
            )

            t_create = TransactionCreate(**t_data)
            created_transactions.append(create_transaction(t_create, user_id))

        return created_transactions

    # CENÁRIO B: Recorrência (Sem parcelas)
    if transaction_in.recurrence_periodicity:
        recurrence_data = RecurrenceCreate(
            name=transaction_in.title,
            amount=transaction_in.amount,
            category_id=transaction_in.category_id,
            account_id=transaction_in.account_id,
            payment_method_id=transaction_in.payment_method.value,
            periodicity=RecurrencePeriodicity(transaction_in.recurrence_periodicity),
            auto_pay=transaction_in.recurrence_auto_pay,
            due_day=transaction_in.date.day,
            active=True,
        )

        recurrence = recurrence_service.create_recurrence(recurrence_data, user_id)

        if transaction_in.recurrence_create_first:
            t_data = transaction_in.model_dump()
            t_data["recurrence_id"] = recurrence.id

            if transaction_in.recurrence_auto_pay:
                today = datetime.now().replace(
                    hour=0, minute=0, second=0, microsecond=0
                )
                t_date = transaction_in.date
                if t_date.tzinfo:
                    t_date = t_date.replace(tzinfo=None)
                t_date = t_date.replace(hour=0, minute=0, second=0, microsecond=0)

                if t_date > today:
                    t_data["status"] = TransactionStatus.PENDING

            t_create = TransactionCreate(**t_data)
            created_transactions.append(create_transaction(t_create, user_id))

        return created_transactions

    # CENÁRIO C: Simples (Default)
    return [create_transaction(transaction_in, user_id)]


def list_transactions(
    user_id: str,
    month: Optional[int] = None,
    year: Optional[int] = None,
    limit: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> list[Transaction]:
    db = get_db()
    # FILTRO DO USUÁRIO
    query = db.collection(COLLECTION_NAME).where(filter=FieldFilter("user_id", "==", user_id))

    transactions = []

    # Se não vieram datas específicas, mas veio mês/ano, calcula o range
    if not start_date and not end_date and month and year:
        start_date, end_date = get_month_range(month, year)

    # OTIMIZAÇÃO: Filtro no Banco de Dados (Requer Índice Composto user_id + date)
    if start_date and end_date:
        if start_date.tzinfo is None:
            pass

        query = query.where(
            filter=FieldFilter("date", ">=", start_date)
        ).where(filter=FieldFilter("date", "<=", end_date))
        # OTIMIZAÇÃO EXTRA: Ordenação e Limite no DB
        # Isso requer índice: user_id ASC, date DESC
        query = query.order_by("date", direction=firestore.Query.DESCENDING)

        if limit:
            query = query.limit(limit)

    try:
        all_transactions = query.stream()
    except Exception as e:
        logger.warning("Erro ao consultar DB (Provavelmente falta índice): %s", e)
        # Fallback: Busca tudo e filtra na memória (Comportamento antigo, lento mas funcional)
        query = db.collection(COLLECTION_NAME).where(filter=FieldFilter("user_id", "==", user_id))
        all_transactions = query.stream()

    # ==========================================
    # N+1 FIX: Batch preload de Categories e Accounts
    # Em vez de fazer 1 query por transação (N+1), fazemos 2 queries totais.
    # ==========================================
    all_categories = category_service.list_all_categories_flat(user_id)
    all_accounts = account_service.list_accounts(user_id)

    # Criar dicionários de lookup O(1)
    cat_map: dict[str, Category] = {c.id: c for c in all_categories}
    acc_map: dict[str, Account] = {a.id: a for a in all_accounts}

    # Objetos placeholder para dados deletados (reutilizados)
    deleted_category = Category(
        id="deleted",
        name="Deleted",
        icon="pi pi-question",
        color="#ccc",
        is_custom=False,
        type="expense",
        user_id=user_id,
    )
    deleted_account = Account(
        id="deleted",
        name="Deleted",
        type="checking",
        balance=0,
        icon="",
        color="",
        user_id=user_id,
    )

    for t in all_transactions:
        data = t.to_dict()

        # Double Check Date (Caso o fallback tenha sido ativado ou para garantir ranges precisos)
        if start_date and end_date:
            t_date = data.get("date")
            if t_date:
                if isinstance(t_date, str):
                    try:
                        t_date = datetime.fromisoformat(t_date.replace("Z", "+00:00"))
                    except (ValueError, TypeError):
                        continue

                # Normalize for comparison
                if isinstance(t_date, datetime):
                    if t_date.tzinfo and not start_date.tzinfo:
                        t_date = t_date.replace(tzinfo=None)
                    elif not t_date.tzinfo and start_date.tzinfo:
                        t_date = t_date.replace(tzinfo=start_date.tzinfo)

                    if not (start_date <= t_date <= end_date):
                        continue

        # O(1) lookup em vez de query individual ao Firestore
        cat_id = data.get("category_id")
        category = cat_map.get(cat_id, deleted_category) if cat_id else deleted_category

        acc_id = data.get("account_id")
        account = acc_map.get(acc_id, deleted_account) if acc_id else deleted_account

        # Helper to get destination account if exists
        dest_acc_id = data.get("destination_account_id")
        destination_account = None
        if dest_acc_id:
            destination_account = acc_map.get(dest_acc_id)

        # Sanitize boolean fields for Pydantic
        if data.get("is_auto_pay") is None:
            data["is_auto_pay"] = False

        transactions.append(
            Transaction(
                id=t.id,
                category=category,
                account=account,
                destination_account=destination_account,
                **data,
            )
        )

    # Sort by date desc
    transactions.sort(key=lambda x: x.date, reverse=True)

    if limit:
        transactions = transactions[:limit]

    return transactions


def update_transaction(
    transaction_id: str, transaction_in: TransactionUpdate, user_id: str
) -> Transaction:
    db = get_db()

    doc_snapshot = db.collection(COLLECTION_NAME).document(transaction_id).get()
    if not doc_snapshot.exists or doc_snapshot.to_dict().get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="Transaction not found")

    doc_ref = doc_snapshot.reference
    old_data = doc_snapshot.to_dict()
    # Serialize Enums/Datetimes to JSON-compatible format for Firestore
    update_data = transaction_in.model_dump(exclude_unset=True, mode="json")

    # Merge for logic check (simulating what the new state will be)
    new_full_data = {**old_data, **update_data}

    old_status = old_data.get("status", TransactionStatus.PAID)
    new_status = new_full_data.get("status", TransactionStatus.PAID)

    # --- BALANCE UPDATE LOGIC ---
    fields_affecting_balance = [
        "amount",
        "account_id",
        "status",
        "type",
        "credit_card_id",
    ]
    changed = any(
        old_data.get(f) != new_full_data.get(f) for f in fields_affecting_balance
    )

    if changed:
        # 1. Revert Old (If it impacted balance)
        if old_status == TransactionStatus.PAID and not old_data.get("credit_card_id"):
            _update_account_balance(
                db,
                old_data.get("account_id"),
                old_data.get("amount", 0),
                old_data.get("type"),
                user_id,
                revert=True,
                destination_account_id=old_data.get("destination_account_id"),
            )

        # 2. Apply New (If it impacts balance)
        if new_status == TransactionStatus.PAID and not new_full_data.get(
            "credit_card_id"
        ):
            _update_account_balance(
                db,
                new_full_data.get("account_id"),
                new_full_data.get("amount", 0),
                new_full_data.get("type"),
                user_id,
                revert=False,
                destination_account_id=new_full_data.get("destination_account_id"),
            )

    # Apply Update (Using JSON compatible data)
    if update_data:
        doc_ref.update(update_data)

    # Construct Response
    category_id = new_full_data.get("category_id")
    account_id = new_full_data.get("account_id")

    category = category_service.get_category(category_id, user_id)
    if not category:
        category = Category(
            id="deleted",
            name="Deleted",
            icon="pi pi-question",
            color="#ccc",
            is_custom=False,
            type="expense",
            user_id=user_id,
        )

    account = account_service.get_account(account_id, user_id)
    if not account:
        account = Account(
            id="deleted",
            name="Deleted",
            type="checking",
            balance=0,
            icon="",
            color="",
            user_id=user_id,
        )

    dest_acc_id = new_full_data.get("destination_account_id")
    destination_account = None
    if dest_acc_id:
        destination_account = account_service.get_account(dest_acc_id, user_id)

    # Sanitize boolean fields for Pydantic (TransactionBase expects bool, not None)
    if new_full_data.get("is_auto_pay") is None:
        new_full_data["is_auto_pay"] = False

    # Ensure ID is present
    return Transaction(
        id=transaction_id,
        category=category,
        account=account,
        destination_account=destination_account,
        **new_full_data,
    )


def delete_transaction(transaction_id: str, user_id: str, scope: str = "all"):
    """
    Deleta transação com suporte a escopo para parcelamentos.
    scope: 'single' = apenas esta parcela, 'future' = esta + futuras, 'all' = todo o grupo.
    """
    db = get_db()

    doc_snapshot = db.collection(COLLECTION_NAME).document(transaction_id).get()
    if not doc_snapshot.exists or doc_snapshot.to_dict().get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="Transaction not found")

    doc_ref = doc_snapshot.reference
    data = doc_snapshot.to_dict()
    installment_group_id = data.get("installment_group_id")

    # Lógica de Exclusão em Grupo (Se for parcelado)
    if installment_group_id and scope != "single":
        current_installment_number = data.get("installment_number", 1)

        # Busca todas as parcelas do grupo
        group_query = (
            db.collection(COLLECTION_NAME)
            .where(filter=FieldFilter("user_id", "==", user_id))
            .where(filter=FieldFilter("installment_group_id", "==", installment_group_id))
            .stream()
        )

        deleted_count = 0
        for t in group_query:
            t_data = t.to_dict()
            t_installment_number = t_data.get("installment_number", 1)

            # Se scope=future, pula parcelas anteriores à atual
            if scope == "future" and t_installment_number < current_installment_number:
                continue

            t_id = t.id
            t_amount = t_data.get("amount", 0)
            t_type = t_data.get("type")
            t_account_id = t_data.get("account_id")
            t_status = t_data.get("status", TransactionStatus.PAID)

            # Estorna Saldo APENAS SE ESTAVA PAGO E NÃO ERA CARTÃO
            t_credit_card_id = t_data.get("credit_card_id")
            if (
                t_account_id
                and t_status == TransactionStatus.PAID
                and not t_credit_card_id
            ):
                _update_account_balance(
                    db,
                    t_account_id,
                    t_amount,
                    t_type,
                    user_id,
                    revert=True,
                    destination_account_id=t_data.get("destination_account_id"),
                )

            db.collection(COLLECTION_NAME).document(t_id).delete()
            deleted_count += 1

        return {
            "status": "success",
            "message": f"Deleted {deleted_count} transactions from group",
        }

    # Lógica Simples (Não é parcelado OU scope == "single")
    amount = data.get("amount", 0)
    t_type = data.get("type")
    account_id = data.get("account_id")
    status = data.get("status", TransactionStatus.PAID)
    credit_card_id = data.get("credit_card_id")

    # Estorna Saldo APENAS SE ESTAVA PAGO E NÃO ERA CARTÃO
    if account_id and status == TransactionStatus.PAID and not credit_card_id:
        _update_account_balance(
            db,
            account_id,
            amount,
            t_type,
            user_id,
            revert=True,
            destination_account_id=data.get("destination_account_id"),
        )

    doc_ref.delete()

    return {"status": "success", "message": "Transaction deleted"}


def update_installment_group(
    transaction_id: str,
    transaction_in: TransactionUpdate,
    user_id: str,
    scope: str = "single",
) -> List[Transaction]:
    """
    Atualiza parcelas com suporte a escopo.
    scope: 'single' = apenas esta, 'future' = esta + futuras, 'all' = todo o grupo.
    """
    db = get_db()

    # Primeiro, atualiza a parcela principal
    updated_main = update_transaction(transaction_id, transaction_in, user_id)

    if scope == "single":
        return [updated_main]

    main_data = db.collection(COLLECTION_NAME).document(transaction_id).get().to_dict()
    installment_group_id = main_data.get("installment_group_id")

    if not installment_group_id:
        return [updated_main]

    current_installment_number = main_data.get("installment_number", 1)

    # Campos seguros para propagar em lote (não propagar data, status, payment_date)
    safe_fields = {}
    update_data = transaction_in.model_dump(exclude_unset=True, mode="json")
    propagatable = [
        "category_id",
        "account_id",
        "payment_method",
        "title",
        "credit_card_id",
        "amount",
    ]
    for field in propagatable:
        if field in update_data:
            safe_fields[field] = update_data[field]

    if not safe_fields:
        return [updated_main]

    # Busca as outras parcelas do grupo
    group_query = (
        db.collection(COLLECTION_NAME)
        .where(filter=FieldFilter("user_id", "==", user_id))
        .where(filter=FieldFilter("installment_group_id", "==", installment_group_id))
        .stream()
    )

    updated_transactions = [updated_main]

    for t in group_query:
        t_id = t.id
        if t_id == transaction_id:
            continue  # Já atualizada acima

        t_data = t.to_dict()
        t_installment_number = t_data.get("installment_number", 1)

        # Se scope=future, pula parcelas anteriores à atual
        if scope == "future" and t_installment_number < current_installment_number:
            continue

        # Monta update específico para esta parcela
        patch = dict(safe_fields)

        # Se título mudou, preserva o sufixo "(N/Total)"
        if "title" in patch:
            total = t_data.get("total_installments", 1)
            base_title = patch["title"]
            # Remove sufixo existente se houver
            if "(" in base_title and "/" in base_title:
                base_title = base_title.rsplit("(", 1)[0].strip()
            patch["title"] = f"{base_title} ({t_installment_number}/{total})"
            patch["description"] = patch["title"]

        # Aplica atualização de saldo se necessário
        balance_fields = ["amount", "account_id", "credit_card_id"]
        balance_changed = any(f in patch for f in balance_fields)

        if balance_changed:
            old_status = t_data.get("status", TransactionStatus.PAID)
            old_credit_card = t_data.get("credit_card_id")

            # Reverte saldo antigo se pago e sem cartão
            if old_status == TransactionStatus.PAID and not old_credit_card:
                _update_account_balance(
                    db,
                    t_data.get("account_id"),
                    t_data.get("amount", 0),
                    t_data.get("type"),
                    user_id,
                    revert=True,
                    destination_account_id=t_data.get("destination_account_id"),
                )

            # Aplica novo saldo
            new_data = {**t_data, **patch}
            new_credit_card = new_data.get("credit_card_id")
            if old_status == TransactionStatus.PAID and not new_credit_card:
                _update_account_balance(
                    db,
                    new_data.get("account_id"),
                    new_data.get("amount", 0),
                    new_data.get("type"),
                    user_id,
                    revert=False,
                    destination_account_id=new_data.get("destination_account_id"),
                )

        db.collection(COLLECTION_NAME).document(t_id).update(patch)

    return updated_transactions


def get_upcoming_transactions(user_id: str, limit: int = 10) -> List[Transaction]:
    db = get_db()
    today = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    query = (
        db.collection(COLLECTION_NAME)
        .where(filter=FieldFilter("user_id", "==", user_id))
        .where(filter=FieldFilter("status", "==", TransactionStatus.PENDING))
        .where(filter=FieldFilter("date", ">=", today))
        .order_by("date", direction=firestore.Query.ASCENDING)
        .limit(limit)
    )

    docs = query.stream()

    # Batch preload to avoid N+1 queries
    all_categories = category_service.list_all_categories_flat(user_id)
    all_accounts = account_service.list_accounts(user_id)

    cat_map: dict[str, Category] = {c.id: c for c in all_categories}
    acc_map: dict[str, Account] = {a.id: a for a in all_accounts}

    deleted_category = Category(
        id="deleted",
        name="?",
        icon="pi pi-question",
        color="#ccc",
        is_custom=False,
        type="expense",
        user_id=user_id,
    )
    deleted_account = Account(
        id="deleted",
        name="?",
        type="checking",
        balance=0,
        icon="",
        color="",
        user_id=user_id,
    )

    transactions = []
    for t in docs:
        data = t.to_dict()

        cat_id = data.get("category_id")
        category = cat_map.get(cat_id, deleted_category) if cat_id else deleted_category

        acc_id = data.get("account_id")
        account = acc_map.get(acc_id, deleted_account) if acc_id else deleted_account

        if "title" not in data and "description" in data:
            data["title"] = data.pop("description")
            data["description"] = None

        dest_acc_id = data.get("destination_account_id")
        destination_account = acc_map.get(dest_acc_id) if dest_acc_id else None

        # Sanitize boolean fields for Pydantic
        if data.get("is_auto_pay") is None:
            data["is_auto_pay"] = False

        transactions.append(
            Transaction(
                id=t.id,
                category=category,
                account=account,
                destination_account=destination_account,
                **data,
            )
        )

    return transactions


def delete_all_transactions(user_id: str):
    db = get_db()
    docs = db.collection(COLLECTION_NAME).where(filter=FieldFilter("user_id", "==", user_id)).stream()

    batch = db.batch()
    count = 0
    deleted_count = 0

    for doc in docs:
        batch.delete(doc.reference)
        count += 1

        if count >= 400:
            batch.commit()
            batch = db.batch()
            deleted_count += count
            count = 0

    if count > 0:
        batch.commit()
        deleted_count += count

    return deleted_count


def get_first_transaction_date(user_id: str) -> Optional[datetime]:
    """
    Returns the date of the very first transaction for the user.
    Used for calculating averages for new users (adaptive timeframe).
    """
    db = get_db()

    # Query for the oldest transaction
    query = (
        db.collection(COLLECTION_NAME)
        .where(filter=FieldFilter("user_id", "==", user_id))
        .order_by("date", direction=firestore.Query.ASCENDING)
        .limit(1)
    )

    docs = list(query.stream())

    if not docs:
        return None

    data = docs[0].to_dict()
    first_date = data.get("date")

    # Ensure it's a datetime
    if isinstance(first_date, str):
        try:
            first_date = datetime.fromisoformat(first_date.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            return None

    if isinstance(first_date, datetime):
        # Convert to naive if needed or keep timezone?
        # Usually internal logic prefers naive UTC or consistent timezone.
        # Let's return as is, caller handles logic.
        return first_date

    return None


def list_pending_tithes(user_id: str) -> List[Transaction]:
    """Lista todas as receitas com dízimo pendente."""
    db = get_db()

    query = (
        db.collection(COLLECTION_NAME)
        .where(filter=FieldFilter("user_id", "==", user_id))
        .where(filter=FieldFilter("type", "==", "income"))
        .where(filter=FieldFilter("tithe_status", "==", "PENDING"))
    )

    transactions = []

    try:
        docs = query.stream()
    except Exception as e:
        logger.warning(
            "Erro ao consultar dízimos pendentes (Provavelmente falta índice): %s", e
        )
        # Fallback: Query sem filtro de tithe_status
        query = (
            db.collection(COLLECTION_NAME)
            .where(filter=FieldFilter("user_id", "==", user_id))
            .where(filter=FieldFilter("type", "==", "income"))
        )
        docs = query.stream()

    for t in docs:
        data = t.to_dict()

        # Filtro de segurança (se usou fallback)
        if data.get("tithe_status") != "PENDING":
            continue

        cat_id = data.get("category_id")
        category = category_service.get_category(cat_id, user_id)
        if not category:
            category = Category(
                id="deleted",
                name="Deleted",
                icon="pi pi-question",
                color="#ccc",
                is_custom=False,
                type="income",
                user_id=user_id,
            )

        acc_id = data.get("account_id")
        account = account_service.get_account(acc_id, user_id)
        if not account:
            account = Account(
                id="deleted",
                name="Deleted",
                type="checking",
                balance=0,
                icon="",
                color="",
                user_id=user_id,
            )

        dest_acc_id = data.get("destination_account_id")
        destination_account = None
        if dest_acc_id:
            destination_account = account_service.get_account(dest_acc_id, user_id)

        if data.get("is_auto_pay") is None:
            data["is_auto_pay"] = False

        transactions.append(
            Transaction(
                id=t.id,
                category=category,
                account=account,
                destination_account=destination_account,
                **data,
            )
        )

    transactions.sort(key=lambda x: x.date, reverse=True)
    return transactions


def batch_pay_tithes(user_id: str) -> dict:
    """Marca todas as receitas com dízimo PENDING como PAID."""
    db = get_db()

    query = (
        db.collection(COLLECTION_NAME)
        .where(filter=FieldFilter("user_id", "==", user_id))
        .where(filter=FieldFilter("type", "==", "income"))
        .where(filter=FieldFilter("tithe_status", "==", "PENDING"))
    )

    try:
        docs = list(query.stream())
    except Exception as e:
        logger.warning("Erro ao buscar dízimos pendentes para batch: %s", e)
        # Fallback
        query = (
            db.collection(COLLECTION_NAME)
            .where(filter=FieldFilter("user_id", "==", user_id))
            .where(filter=FieldFilter("type", "==", "income"))
        )
        docs = [
            d for d in query.stream() if d.to_dict().get("tithe_status") == "PENDING"
        ]

    if not docs:
        return {
            "status": "success",
            "message": "Nenhum dízimo pendente encontrado.",
            "updated_count": 0,
        }

    batch = db.batch()
    count = 0
    total_batched = 0

    for doc in docs:
        batch.update(doc.reference, {"tithe_status": "PAID"})
        count += 1

        # Firestore batch limit: 500 ops
        if count >= 400:
            batch.commit()
            batch = db.batch()
            total_batched += count
            count = 0

    if count > 0:
        batch.commit()
        total_batched += count

    return {
        "status": "success",
        "message": f"{total_batched} dízimo(s) marcado(s) como pago.",
        "updated_count": total_batched,
    }
