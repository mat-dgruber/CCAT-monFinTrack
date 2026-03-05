# Schema do Firestore - MonFinTrack

Este documento detalha o modelo de dados utilizado no Firestore. Os modelos são definidos rigorosamente no backend via **Pydantic**, garantindo validação antes da persistência.

> **Nota:** Todos os documentos possuem campos de controle como `id`, `created_at` e `updated_at`. As coleções podem ser top-level com índice em `user_id` ou subcoleções de `users/{userId}/...` dependendo da implementação do serviço. A estrutura abaixo foca na **estrutura lógica do documento**.

---

## 1. Users (`users`)

Armazena preferências e perfil do usuário.

- `user_id` (String, PK)
- `language` (String): ex: "pt-BR"
- `theme` (String): "light" ou "dark"
- `notifications_enabled` (Boolean)
- `profile_image_url` (String, URL)
- `subscription_tier` (String): "free", "pro", "premium"
- `enable_tithes_offerings` (Boolean): Ativa módulo de dízimos
- `default_tithe_percentage` (Float): Percentual padrão de dízimo
- `default_offering_percentage` (Float): Percentual padrão de oferta
- `auto_apply_tithe` (Boolean): Aplicar dízimo automaticamente em receitas
- `auto_apply_offering` (Boolean): Aplicar oferta automaticamente em receitas
- `privacy_share_data` (Boolean)
- **Stripe Integration:**
  - `stripe_customer_id` (String): ID do cliente no Stripe
  - `stripe_subscription_id` (String): ID da assinatura corrente
  - `subscription_status` (Enum): active, past_due, canceled, trialing
  - `current_period_end` (Timestamp): Data de expiração/renovação

---

## 2. Accounts (`accounts`)

Representa locais onde o dinheiro está armazenado ou fontes de crédito.

- `user_id` (String): Dono da conta [Indexado]
- `name` (String)
- `type` (Enum): checking, savings, investment, cash, credit_card
- `balance` (Float): Saldo atual. Se `credit_card`, geralmente representa o saldo devedor ou disponível dependendo da lógica.
- `color` (String): Hex code
- `icon` (String)
- `credit_cards` (Array de Objetos): Para contas que possuem cartões vinculados (múltiplos cartões na mesma conta bancária).
  - `name`, `brand`, `limit`, `closing_day`, `invoice_due_day`

---

## 3. Categories (`categories`)

Classificação de transações.

- `user_id` (String): Dono da categoria [Indexado]
- `name` (String)
- `icon` (String)
- `color` (String)
- `type` (Enum): expense, income, transfer
- `is_custom` (Boolean): Se foi criada pelo usuário.
- `parent_id` (String, Opcional): Para subcategorias.
- `is_hidden` (Boolean)

---

## 4. Transactions (`transactions`)

O coração do sistema. Cada entrada ou saída financeira.

- `user_id` (String): Dono da transação [Indexado]
- `title` (String)
- `description` (String, HTML Sanitized)
- `amount` (Float): Valor absoluto.
- `type` (Enum): expense, income, transfer
- `date` (Timestamp)
- `payment_date` (Timestamp): Quando o dinheiro efetivamente saiu.
- `status` (Enum): pending, paid
- `payment_method` (Enum): credit_card, debit_card, pix, cash, etc.
- **Relacionamentos:**
  - `account_id` (String): Conta de origem.
  - `category_id` (String)
  - `destination_account_id` (String, Opcional): Para transferências.
  - `credit_card_id` (String, Opcional): Se foi pago com cartão específico.
- **Recorrência & Parcelamento:**
  - `recurrence_id` (String): ID da regra de recorrência pai.
  - `installment_group_id` (String): ID que agrupa parcelas de uma mesma compra.
  - `installment_number` (Int)
  - `total_installments` (Int)
- **Módulo Religioso (Opcional, apenas `type=income`):**
  - `tithe_amount` (Float): Valor absoluto do dízimo calculado
  - `tithe_percentage` (Float): Percentual do dízimo (ex: 10)
  - `offering_amount` (Float): Valor absoluto da oferta
  - `offering_percentage` (Float): Percentual da oferta
  - `tithe_status` (Enum): `NONE`, `PENDING`, `PAID`
  - `net_amount` (Float): Valor líquido (amount - tithe - offering)
  - `gross_amount` (Float): Valor bruto original
  - ⚠️ **Regra:** Campos de dízimo são **nulos** para `type=expense` e `type=transfer`
- **Anexos:**
  - `attachments` (Array de Strings): URLs do Firebase Storage.

---

## 5. Debts (`debts`)

Gestão de Dívidas, Financiamentos e Empréstimos. Difere de transações parceladas por ter juros compostos e lógica de amortização.

- `user_id` (String): Dono da dívida [Indexado]
- `name` (String)
- `debt_type` (Enum): loan, financing, credit_card (rotativo), overdraft (cheque especial)
- `status` (Enum): on_time, late, negotiation
- `total_amount` (Float): Saldo devedor atual.
- `original_amount` (Float)
- `interest_rate` (Float): Taxa de juros.
- `interest_period` (Enum): monthly, yearly
- `cet` (Float): Custo Efetivo Total.
- **Detalhes de Pagamento:**
  - `minimum_payment` (Float)
  - `due_day` (Int)
  - `remaining_installments` (Int)
- **Campos Avançados (Imóveis/Veículos):**
  - `indexer` (String): IPCA, TR, etc.
  - `property_value` (Float)
  - `amortization_system` (Enum): SAC, PRICE
  - `contract_file_path` (String): Caminho do PDF analisado pela IA.

---

## Notas de Implementação

- **Ids:** UUIDs v4 (strings) gerados geralmente pelo backend ou auto-id do Firestore.
- **Datas:** Armazenadas como Timestamp nativo do Firestore ou ISO String dependendo da serialização. O Backend usa `datetime` do Python.

---

## 6. Storage Structure (Firebase Storage)

Estrutura de pastas para arquivos envidados:

- `users/{userId}/profile/`
  - Imagens de perfil (jpg, png). Limitado a 5MB.
- `users/{userId}/attachments/`
  - Comprovantes e anexos de transações. Imagens ou PDF. Limitado a 10MB.
- `users/{userId}/debts/`
  - Contratos e documentos de dívidas. Imagens ou PDF. Limitado a 15MB.

---

## 7. Budgets (`budgets`)

Metas de gastos mensais ou anuais por categoria.

- `user_id` (String): Dono do orçamento [Indexado]
- `category_id` (String)
- `amount` (Float): Meta de valor.
- `month` (Int, Opcional)
- `year` (Int, Opcional)
- `period` (Enum): monthly, yearly

---

## 8. Recurrences (`recurrences`)

Regras para transações que se repetem (Assinaturas, Salários).

- `user_id` (String): Dono da recorrência [Indexado]
- `title` (String)
- `amount` (Float)
- `next_date` (Timestamp)
- `frequency` (Enum): daily, weekly, monthly, yearly
- `interval` (Int): De quanto em quanto tempo (ex: a cada 2 semanas).
- `skipped_dates` (Array[Date]): Ocorrências puladas.
- `category_id` (String)
- `account_id` (String)

---

## 9. Seasonal Incomes (`seasonal_incomes`)

Planejamento de receitas variáveis (ex: Bônus, 13º).

- `user_id` (String): PK [Indexado]
- `name` (String)
- `amount` (Float)
- `receive_date` (Date)
- `is_recurrence` (Boolean)

---

## 10. Invoices (`invoices`)

Faturas de cartão de crédito (Snapshots mensais).

- `user_id` (String)
- `credit_card_id` (String)
- `month` (Int)
- `year` (Int)
- `total_amount` (Float)
- `status` (Enum): open, closed, paid
- `due_date` (Date)
- `closing_date` (Date)
