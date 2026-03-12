# app/services/debt_alert_service.py
from datetime import date, datetime
from typing import Any, Dict, List
from dateutil.relativedelta import relativedelta


class DebtAlertService:

    @staticmethod
    def get_alerts(debt) -> List[Dict[str, Any]]:
        alerts = []
        today = date.today()
        debt_dict = debt.model_dump() if hasattr(debt, 'model_dump') else debt

        dtype = debt_dict.get("debt_type", "")

        # ── IMÓVEL ──────────────────────────────────────────
        if dtype == "real_estate_financing":

            # Subsídio em risco
            exp = debt_dict.get("subsidy_expiration_date")
            if exp:
                exp_date = date.fromisoformat(str(exp)) if isinstance(exp, str) else exp
                dias = (exp_date - today).days
                if 0 < dias <= 365:
                    alerts.append({
                        "type": "warning",
                        "code": "SUBSIDY_EXPIRING",
                        "title": "Carência de Subsídio",
                        "message": f"Cuidado: amortizar antecipadamente antes de {exp_date.strftime('%d/%m/%Y')} pode exigir devolução do subsídio ({dias} dias restantes).",
                        "priority": 1,
                    })

            # FGTS — intervalo mínimo
            last_fgts = debt_dict.get("last_fgts_usage_date")
            interval = debt_dict.get("fgts_usage_interval", 36)
            if last_fgts:
                last_date = date.fromisoformat(str(last_fgts)) if isinstance(last_fgts, str) else last_fgts
                next_allowed = last_date + relativedelta(months=interval)
                if today < next_allowed:
                    alerts.append({
                        "type": "info",
                        "code": "FGTS_INTERVAL",
                        "title": "FGTS Indisponível",
                        "message": f"Próximo uso do FGTS permitido em {next_allowed.strftime('%d/%m/%Y')}.",
                        "priority": 3,
                    })

            # Obra em atraso
            if debt_dict.get("is_under_construction"):
                end = debt_dict.get("construction_end_date")
                if end:
                    end_date = date.fromisoformat(str(end)) if isinstance(end, str) else end
                    if today > end_date:
                        alerts.append({
                            "type": "error",
                            "code": "CONSTRUCTION_OVERDUE",
                            "title": "Obra em Atraso",
                            "message": f"A data prevista de entrega ({end_date.strftime('%d/%m/%Y')}) já passou. Verifique seus direitos contratuais.",
                            "priority": 1,
                        })

        # ── VEÍCULO ─────────────────────────────────────────
        if dtype == "vehicle_financing":

            if not debt_dict.get("gravame_registered"):
                alerts.append({
                    "type": "error",
                    "code": "GRAVAME_NOT_REGISTERED",
                    "title": "Gravame não registrado",
                    "message": "O gravame de alienação fiduciária não foi registrado no DETRAN. Isso pode causar vencimento antecipado da dívida.",
                    "priority": 1,
                })

            if not debt_dict.get("vehicle_insurance_active"):
                alerts.append({
                    "type": "error",
                    "code": "INSURANCE_INACTIVE",
                    "title": "Seguro inativo",
                    "message": "O veículo financiado precisa estar segurado com a instituição como beneficiária. Regularize imediatamente.",
                    "priority": 1,
                })
            else:
                ins_exp = debt_dict.get("vehicle_insurance_expiry")
                if ins_exp:
                    ins_date = date.fromisoformat(str(ins_exp)) if isinstance(ins_exp, str) else ins_exp
                    dias = (ins_date - today).days
                    if 0 < dias <= 30:
                        alerts.append({
                            "type": "warning",
                            "code": "INSURANCE_EXPIRING",
                            "title": "Seguro vencendo",
                            "message": f"O seguro do veículo vence em {ins_date.strftime('%d/%m/%Y')} ({dias} dias). Renove antes do vencimento.",
                            "priority": 2,
                        })

            if not debt_dict.get("ipva_paid"):
                alerts.append({
                    "type": "warning",
                    "code": "IPVA_UNPAID",
                    "title": "IPVA não pago",
                    "message": "O não pagamento do IPVA pode causar vencimento antecipado do financiamento.",
                    "priority": 2,
                })

            if not debt_dict.get("licensing_ok"):
                alerts.append({
                    "type": "warning",
                    "code": "LICENSING_PENDING",
                    "title": "Licenciamento pendente",
                    "message": "O licenciamento do veículo está pendente. Regularize para evitar vencimento antecipado.",
                    "priority": 2,
                })

        # ── CARTÃO ROTATIVO ─────────────────────────────────
        if dtype == "credit_card_rotating":
            months_rot = debt_dict.get("months_in_revolving", 0)
            if months_rot >= 2:
                alerts.append({
                    "type": "error",
                    "code": "REVOLVING_SNOWBALL",
                    "title": "Bola de neve no rotativo",
                    "message": f"Você está há {months_rot} meses no rotativo. Com taxas acima de 100% a.a., esta é a dívida mais urgente para quitar.",
                    "priority": 1,
                })

        # ── CHEQUE ESPECIAL ─────────────────────────────────
        if dtype == "overdraft":
            days = debt_dict.get("overdraft_days_used", 0)
            if days >= 25:
                alerts.append({
                    "type": "warning",
                    "code": "OVERDRAFT_RATE_CHANGE",
                    "title": "Limite de 30 dias se aproximando",
                    "message": f"Você está há {days} dias usando o cheque especial. Após 30 dias, o BCB pode exigir taxa diferenciada.",
                    "priority": 2,
                })

        # ── CONSIGNADO FGTS ─────────────────────────────────
        if dtype == "consigned_credit":
            if debt_dict.get("blocks_fgts_withdrawal"):
                alerts.append({
                    "type": "warning",
                    "code": "FGTS_BLOCKED",
                    "title": "FGTS bloqueado",
                    "message": "Este consignado bloqueia o saque do FGTS em caso de rescisão sem justa causa até o término do contrato.",
                    "priority": 2,
                })

        # Ordenar por prioridade
        return sorted(alerts, key=lambda x: x["priority"])
