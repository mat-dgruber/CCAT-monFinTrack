# ⚙️ monFinTrack - Backend

<div align="center">
  <img src="https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" alt="Firebase" />
  <img src="https://img.shields.io/badge/Pydantic-E92067?style=for-the-badge&logo=pydantic&logoColor=white" alt="Pydantic" />
  <img src="https://img.shields.io/badge/Pytest-0A9EDC?style=for-the-badge&logo=pytest&logoColor=white" alt="Pytest" />
</div>

Este é o motor do **monFinTrack**, uma API robusta construída com **FastAPI** para gerenciar todas as operações financeiras e integrações de inteligência artificial.

---

## 🚀 Tecnologias

- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) - Moderno, rápido e com tipagem forte.
- **Banco de Dados**: [Firebase Firestore](https://firebase.google.com/docs/firestore) - NoSQL escalável em tempo real.
- **Validação**: [Pydantic v2](https://docs.pydantic.dev/) - Garantia de integridade de dados.
- **Inteligência Artificial**: [Google Gemini Pro](https://ai.google.dev/) - Insights financeiros automáticos.
- **Gestão de Pacotes**: [uv](https://github.com/astral-sh/uv) - O gestor de pacotes Python extremamente rápido.

---

## 📋 Pré-requisitos

- **Python 3.13+**
- **uv** (altamente recomendado) ou **pip**
- **Firebase Service Account Key** (`serviceAccountKey.json`)

---

## 🔧 Configuração e Instalação

### 1. Preparar o Ambiente

```bash
# Criar ambiente virtual e instalar dependências
uv sync
# OU
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Configurar o Firebase

Mova sua chave de serviço para:
`backend/app/certs/serviceAccountKey.json`

### 3. Variáveis de Ambiente

Crie um arquivo `.env` no diretório `backend/` com:

```env
GOOGLE_API_KEY=sua_chave_do_gemini
# Outras variáveis necessárias...
```

---

## ⚡ Execução

Inicie o servidor de desenvolvimento:

```bash
uv run uvicorn app.main:app --reload
```

A API estará disponível em: [http://localhost:8000](http://localhost:8000)

- **Swagger UI**: [/docs](http://localhost:8000/docs)
- **ReDoc**: [/redoc](http://localhost:8000/redoc)

---

## 🧪 Testes

Executar a suite de testes automatizados:

```bash
uv run pytest
```

---

## 📂 Estrutura de Pastas

```
backend/
├── app/
│   ├── api/            # Endpoints e roteadores
│   ├── core/           # Configurações globais e segurança
│   ├── schemas/        # Modelos de dados (Pydantic)
│   ├── services/       # Lógica de negócio e integrações
│   └── main.py         # Inicialização da aplicação
├── tests/              # Testes unitários e de integração
└── pyproject.toml      # Configuração do projeto
```

---

## 🛡️ Licença

Licença [MIT](../LICENSE).
