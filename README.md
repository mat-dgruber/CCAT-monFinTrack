# 💰 MonFinTrack

<div align="center">
  <img src="https://img.shields.io/badge/Angular-DD0031?style=for-the-badge&logo=angular&logoColor=white" alt="Angular" />
  <img src="https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" alt="Firebase" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/MIT-yellow.svg?style=for-the-badge" alt="License" />
</div>

<p align="center">
  <strong>MonFinTrack</strong> é uma plataforma robusta de controle financeiro pessoal, projetada para simplificar a gestão de despesas, receitas e orçamentos com inteligência e elegância.
</p>

---

## 🌟 Funcionalidades Principais

- 📊 **Dashboard Interativo**: Visão completa da sua saúde financeira com gráficos dinâmicos.
- 💸 **Gestão de Transações**: Controle total sobre entradas e saídas, com categorização inteligente.
- 🔁 **Recorrências e Assinaturas**: Automação de contas repetitivas e controle de serviços de streaming.
- 🎯 **Planejamento de Orçamentos**: Defina metas de gastos por categoria e acompanhe o progresso em tempo real.
- 🏦 **Multicontas**: Gerencie diversos bancos, carteiras e cartões de crédito em um só lugar.
- 🤖 **IA Financeira**: Insights personalizados e geração de relatórios automáticos usando Google Gemini.
- 🛡️ **Segurança Avançada**:
  - Autenticação robusta via Firebase.
  - Segundo Fator de Autenticação (MFA/TOTP).
  - Isolamento rigoroso de dados por usuário.
- 📱 **Design Responsivo & Dark Mode**: Experiência premium em qualquer dispositivo.

---

## 🛠️ Stack Tecnológica

### 🎨 Frontend

- **Framework**: [Angular v20](https://angular.io/)
- **UI & Estilo**: [PrimeNG](https://primeng.org/) & [Tailwind CSS](https://tailwindcss.com/)
- **Gráficos**: [Chart.js](https://www.chartjs.org/)

### ⚙️ Backend

- **Linguagem**: [Python 3.13](https://www.python.org/)
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/)
- **Banco de Dados**: [Firebase Firestore](https://firebase.google.com/products/firestore)
- **IA**: [Google GenAI (Gemini)](https://ai.google.dev/)

---

## 🚀 Como Começar (Docker)

A forma mais rápida de rodar o projeto é utilizando o Docker Compose.

### Pré-requisitos

- Docker & Docker Compose instalados.
- Chave de serviço do Firebase (`serviceAccountKey.json`) em `backend/app/certs/`.

### Execução

1. **Clone o repositório**:

   ```bash
   git clone https://github.com/seu-usuario/monFinTrack.git
   cd monFinTrack
   ```

2. **Suba os containers**:

   ```bash
   docker-compose up -d --build
   ```

3. **Acesse**:
   - **Frontend**: [http://localhost](http://localhost)
   - **API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🧪 Desenvolvimento & Testes

### Frontend

```bash
cd frontend
npm install
ng serve
```

### Backend

```bash
cd backend
# Recomendado usar 'uv' para gestão de pacotes
uv run uvicorn app.main:app --reload
```

### Testes

- **Backend**: `pytest`
- **Frontend Unit**: `npm test`
- **Frontend E2E**: `npm run test:e2e`

---

## 📝 Licença

Distribuído sob a licença MIT. Veja `LICENSE` para mais informações.

<div align="center">
  Feito com ❤️ para ajudar na sua liberdade financeira.
</div>
