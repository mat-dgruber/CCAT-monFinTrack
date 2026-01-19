# Arquitetura do Projeto - MonFinTrack

Este documento descreve a arquitetura técnica do projeto MonFinTrack, um sistema de gestão financeira pessoal e familiar.

## 🏗 Visão Geral

O sistema é construído sobre uma arquitetura client-server moderna, utilizando **Angular** no frontend e **FastAPI** (Python) no backend, com persistência de dados no **Google Firestore** (NoSQL). A autenticação e outros serviços de infraestrutura são providos pelo **Firebase**.

---

## 💻 Frontend (Web Client)

**Tecnologias:**

- **Framework:** Angular 18+
- **Estilização:** Tailwind CSS + PrimeNG 21+
- **Ícones:** Lucide-Angular / PrimeIcons
- **Linguagem:** TypeScript

**Padrões e Estrutura:**

- **Sintaxe de Controle:** Uso das novas sintaxes `@if`, `@for`, `@switch`.
- **Gerenciamento de Estado:** Foco em **Signals** para reatividade fina, substituindo o uso excessivo de RxJS em componentes.
- **Standalone Components:** Arquitetura baseada inteiramente em componentes standalone (sem NgModules).
- **Estrutura de Diretórios:**
  - `src/app/components`: Componentes visuais reutilizáveis e "Smart Components" de funcionalidades (ex: `transaction-manager`, `debt-planner`).
  - `src/app/services`: Camada de serviço para comunicação com API e lógica de negócios compartilhada.
  - `src/app/models`: Interfaces TypeScript que espelham os schemas do backend.
  - `src/app/guards`: Proteção de rotas (ex: `auth.guard`).

---

## ⚙️ Backend (API REST)

**Tecnologias:**

- **Framework:** FastAPI (Python 3.14)
- **Servidor:** Uvicorn (gerenciado via `uv`)
- **Validação:** Pydantic v2
- **Banco de Dados:** Google Cloud Firestore (Modo Nativo)

**Estrutura do Projeto (`backend/app/`):**

- `main.py`: Ponto de entrada da aplicação. Configura middlewares (CORS, SlowAPI), gerenciamento de exceções e registra as rotas.
- `api/`: Contém os roteadores (endpoints) organizados por domínio (ex: `routers/ai.py`, `routers/debts.py`).
- `schemas/`: Modelos Pydantic (`BaseModel`) para validação de entrada e saída (DTOs). Definem a estrutura dos dados para Accounts, Transactions, Debts, etc.
- `services/`: Lógica de negócios pura, desacoplada das rotas HTTP.
- `core/`: Configurações globais, conexões de banco de dados (`database.py`) e validadores comuns.

**Mecanismos Chave:**

- **Autenticação:** Baseada em tokens (Firebase Auth), validados via dependência injetável nas rotas protegidas.
- **AI Integration:** Módulo dedicado para integração com LLMs (Gemini) para análise financeira e categorização inteligente.

---

## 🗄 Modelo de Dados (Firestore)

O banco de dados é NoSQL, orientado a documentos. Devido à natureza do Firestore, os dados são desnormalizados o suficiente para leituras eficientes, mas mantêm referências via IDs (ex: `category_id`, `account_id`) para integridade lógica.

**Coleções Principais:**

- `users`: Perfis e preferências de usuário.
- `accounts`: Contas bancárias, carteiras e cartões de crédito.
- `transactions`: Entradas e saídas financeiras ("Ledger" principal).
- `categories`: Estrutura de classificação de despesas/receitas.
- `debts`: Gestão de dívidas de longo prazo e financiamentos.

---

## 🔐 Multi-Tenancy & Segurança

O sistema opera em modelo **Multi-Tenant Lógico** (SaaS), onde todos os usuários compartilham a mesma infraestrutura de banco de dados e backend, mas com isolamento rigoroso de dados.

### Estratégia de Isolamento

- **Shared Database:** Uma única instância do Firestore serve a todos os tenants.
- **Row-Level Security:** Cada documento (Transaction, Account, etc.) possui um campo obrigatório `user_id`.
- **Middleware de Autenticação:**
  - O Backend intercepta todas as requisições API.
  - O token do Firebase Auth é validado e decodificado (`app.core.security.get_current_user`).
  - O `uid` extraído é forçosamente injetado em todas as chamadas de serviço (`service.list_transactions(user_id=uid)`).
- **Firestore Security Rules:** Regras nativas do Firestore impedem leituras/escritas diretas (Client SDK) em documentos que não pertençam ao `request.auth.uid`.

### Identidade e Assinaturas

- **Provedor:** Firebase Authentication.
- **Pagamentos:** Stripe (Merchant of Record).
- **Dados do Usuário:**
  - `auth.token`: Contém o `uid`.
  - `custom_claims`: Armazena flags de alto desempenho (`plan_id`, `is_active`).
  - `users/{uid}` (Firestore): Armazena metadados detalhados (`stripe_customer_id`, preferências).

---

## 🚀 Fluxo de Desenvolvimento

1. **Frontend:** `ng serve` (Porta 4200)
2. **Backend:** `uv run uvicorn app.main:app --reload` (Porta 8000)
3. **Deploy:**
   - Frontend: Firebase Hosting
   - Backend: Render / Google Cloud Run (Containerizado via Docker)
