# monFinTrack - Backend

Este é o backend do projeto **monFinTrack**, uma aplicação para gerenciamento financeiro. A API foi construída utilizando **FastAPI** e utiliza o **Firebase Firestore** como banco de dados.

## 🚀 Tecnologias Utilizadas

- [Python](https://www.python.org/)
- [FastAPI](https://fastapi.tiangolo.com/) - Framework web moderno e rápido para construção de APIs.
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup) - Integração com o Firebase Firestore.
- [Pydantic](https://docs.pydantic.dev/) - Validação de dados.
- [Uvicorn](https://www.uvicorn.org/) - Servidor ASGI.
- [Google Generative AI](https://ai.google.dev/) - Inteligência Artificial Generativa.

## 📋 Pré-requisitos

Antes de começar, você precisará ter instalado em sua máquina:

- [Python 3.13+](https://www.python.org/downloads/)
- [Git](https://git-scm.com/)

## 🔧 Instalação e Configuração

### 1. Clone o repositório

Caso ainda não tenha clonado o projeto completo:

```bash
git clone https://github.com/seu-usuario/monFinTrack.git
cd monFinTrack/backend
```

### 2. Crie um ambiente virtual

É recomendável usar um ambiente virtual para isolar as dependências do projeto.

**Windows:**

```bash
python -m venv .venv
.venv\Scripts\activate
```

**Linux/macOS:**

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Instale as dependências

Com o ambiente virtual ativado, instale as dependências listadas no `requirements.txt`:

```bash
pip install -r requirements.txt
# OR using uv (faster)
uv pip install -r requirements.txt
```

> **Nota:** Se você utiliza `uv`, o projeto também contém um arquivo `uv.lock`.

### 4. Configuração do Firebase

Para que a aplicação se conecte ao Firestore, você precisa das credenciais de serviço do Firebase.

1. Acesse o console do Firebase e gere uma nova chave privada para sua conta de serviço.
2. Baixe o arquivo JSON gerado.
3. Renomeie o arquivo para `serviceAccountKey.json`.
4. Mova o arquivo para o diretório: `backend/app/certs/`.

**Caminho final esperado:**
`backend/app/certs/serviceAccountKey.json`

> ⚠️ **Importante:** Nunca commite o arquivo `serviceAccountKey.json` no controle de versão. Ele contém informações sensíveis.

## ⚡ Executando a Aplicação

Para iniciar o servidor de desenvolvimento com _hot-reload_:

```bash
uv run uvicorn app.main:app --reload
```

O servidor iniciará por padrão em `http://127.0.0.1:8000`.

## 🧪 Testes

Para executar os testes unitários:

```bash
python -m pytest
```

## 📖 Documentação da API

O FastAPI gera automaticamente a documentação interativa da API. Com o servidor rodando, acesse:

- **Swagger UI:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc:** [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

## 📂 Estrutura do Projeto

```
backend/
├── app/
│   ├── api/            # Rotas da API
│   ├── certs/          # Certificados e chaves (Firebase)
│   ├── core/           # Configurações principais (Database, etc)
│   ├── models/         # Modelos de domínio (se aplicável)
│   ├── schemas/        # Schemas Pydantic (DTOs)
│   ├── services/       # Lógica de negócio
│   └── main.py         # Ponto de entrada da aplicação
├── .gitignore
├── pyproject.toml
├── requirements.txt
└── README.md
```

## 🛡️ Licença

Este projeto está sob a licença [MIT](../LICENSE).
