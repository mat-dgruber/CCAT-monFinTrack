# Guia de Migração: Render -> Google Cloud Run

Este guia detalha os passos para migrar seu backend FastAPI do Render para o Google Cloud Run, mantendo a integração com o Firebase.

## Pré-requisitos

1.  **Google Cloud CLI (gcloud)** instalado e logado.
    - Se não estiver, execute: `gcloud auth login`
2.  **Projeto Google Cloud** com Billing (Faturamento) ativado.
    - O ID do projeto deve corresponder ao configurado no Firebase (`ccat-monfintrack`).

## Passo 1: Configurar Projeto e APIs

Execute os comandos abaixo no terminal (na raiz do projeto) para ativar os serviços necessários:

```powershell
# Definir o projeto padrão
gcloud config set project ccat-monfintrack

# Ativar APIs do Cloud Run, Cloud Build e Artifact Registry
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

## Passo 2: Implantar o Backend (Cloud Run)

Você pode fazer o deploy diretamente do código fonte (o Google Cloud Build vai construir o container para você).

No diretório `backend`:

```powershell
cd backend
gcloud run deploy monfintrack-backend `
  --source . `
  --region southamerica-east1 `
  --allow-unauthenticated
```

Durante o deploy, o Google vai perguntar se você quer criar um repositório no Artifact Registry (responda `y`).

**Variáveis de Ambiente:**
Se você precisar de variáveis de ambiente (como `STRIPE_API_KEY`), adicione a flag `--set-env-vars`:

```powershell
gcloud run deploy monfintrack-backend `
  --source . `
  --region southamerica-east1 `
  --allow-unauthenticated `
  --set-env-vars STRIPE_API_KEY=sua_chave_aqui,OUTRA_VAR=valor
```

_Dica: Para o Firebase, não precisamos mais do `FIREBASE_CREDENTIALS_JSON` pois o Cloud Run usa a identidade automática do serviço!_

## Passo 3: Conectar com Firebase Hosting

Nós já configuramos o arquivo `firebase.json` para redirecionar as chamadas de `/api/**` para o Cloud Run.

Agora, basta fazer o deploy das regras do Firebase Hosting:

```powershell
# Volte para a raiz
cd ..
firebase deploy --only hosting
```

## Validando a Migração

1.  Acesse sua URL do Firebase (ex: `https://ccat-monfintrack.web.app/api/health` ou similar).
2.  Ela deve responder com os dados do backend.
3.  Verifique os logs no Console do Google Cloud Run se houver erros.

## Observações Importantes

- **CORS:** O Cloud Run pode exigir configurações de CORS. No código atual, o FastAPI já lida com CORS, então deve funcionar.
- **Custos:** O Cloud Run cobra por uso (CPU/Memória alocada durante requisições). O Artifact Registry cobra pelo armazenamento das imagens Docker.
