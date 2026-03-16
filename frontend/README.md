# 🎨 monFinTrack - Frontend

<div align="center">
  <img src="https://img.shields.io/badge/Angular-DD0031?style=for-the-badge&logo=angular&logoColor=white" alt="Angular" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/PrimeNG-DD0031?style=for-the-badge&logo=primeng&logoColor=white" alt="PrimeNG" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Firebase_Hosting-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" alt="Firebase Hosting" />
</div>

Esta é a interface moderna e intuitiva do **monFinTrack**, construída com **Angular** para proporcionar a melhor experiência de gestão financeira pessoal.

---

## 🚀 Tecnologias

- **Framework**: [Angular v20](https://angular.io/) - Framework robusto e componentizado.
- **UI Kit**: [PrimeNG](https://primeng.org/) - Componentes visuais ricos e acessíveis.
- **Estilização**: [Tailwind CSS](https://tailwindcss.com/) - Estilo atômico e utilitário.
- **Gráficos**: [Chart.js](https://www.chartjs.org/) - Visualização de dados interativa.
- **Hospedagem**: [Firebase Hosting](https://firebase.google.com/products/hosting) - CDN rápida e segura.

---

## 🔧 Configuração e Instalação

### 1. Pré-requisitos

- Node.js (recomendado v20+)
- npm ou yarn

### 2. Instalar Dependências

Navegue até o diretório `frontend/`:

```bash
cd frontend
npm install --legacy-peer-deps
```

### 3. Execução Local

Inicie o servidor de desenvolvimento:

```bash
ng serve
```

Acesse em: [http://localhost:4200](http://localhost:4200)

---

## 🧪 Testes

A suite de testes garante a estabilidade da interface:

- **Unitários (Karma)**:
  ```bash
  npm test
  ```
- **End-to-End (Playwright)**:
  ```bash
  npx playwright install
  npm run test:e2e
  ```

---

## 🚀 Deploy

A aplicação está configurada para deploy no **Firebase Hosting**.

1. **Build de Produção**:
   ```bash
   npm run build
   ```
2. **Deploy**:
   ```bash
   firebase deploy --only hosting
   ```

---

## 📂 Estrutura de Pastas

```
frontend/
├── src/
│   ├── app/
│   │   ├── components/  # Componentes reutilizáveis
│   │   ├── pages/       # Telas principais
│   │   ├── services/    # Lógica de chamadas de API
│   │   └── shared/      # Utilitários, pipes e diretivas
│   ├── assets/          # Imagens, ícones e fontes
│   └── environments/    # Configurações de API e Firebase
├── tailwind.config.js   # Configuração do Tailwind
└── angular.json         # Configuração do Angular
```

---

## 🛡️ Licença

Licença [MIT](../LICENSE).
