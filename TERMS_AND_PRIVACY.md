# Termos de Uso e Política de Privacidade - monFinTrack

**Última atualização:** 17 de Março de 2026

Bem-vindo ao **monFinTrack**. Este documento unificado estabelece os Termos de Uso e a Política de Privacidade que regem o relacionamento entre você (usuário) e o monFinTrack, baseando-se nas melhores práticas de gerenciamento, segurança, governança de dados e no uso ético de Inteligência Artificial.

---

## PARTE I: TERMOS DE USO

### 1. Aceitação dos Termos

Ao acessar, criar uma conta e utilizar o monFinTrack (em seus planos gratuitos ou pagos), você concorda integralmente com estes termos. Se não concordar com qualquer parte, você não deve utilizar o serviço.

### 2. Descrição do Serviço

O monFinTrack é uma plataforma de gestão financeira pessoal e análise de dados que permite:

- **Estruturação:** Cadastro de contas, categorias e subcategorias.
- **Modelagem:** Registro de transações (receitas e despesas), faturas de cartão e orçamentos.
- **Análise Tradicional:** Visualização de dashboards, gráficos de evolução e progresso de metas.
- **Análise por Inteligência Artificial:** Extração automatizada de dados de recibos (Scanner) e análises de comportamento financeiro ("Advisor" / "Modo Roast").

### 3. Inteligência Artificial e Isenção de Responsabilidade

Nossa plataforma utiliza modelos avançados de Inteligência Artificial (Google Gemini) para automatizar e analisar dados.

- **Aviso Legal:** A IA do monFinTrack atua apenas como uma ferramenta analítica de apoio. **Nenhum insight, conselho ou "Modo Roast" gerado pelo sistema constitui ou substitui a orientação de um contador, advogado ou consultor financeiro certificado.**
- **Precisão:** O monFinTrack não garante 100% de exatidão na extração de dados via Scanner ou nas análises geradas. É de total responsabilidade do usuário revisar, validar e aprovar os dados antes de salvá-los no banco de dados.

### 4. Assinaturas e Pagamentos (Stripe)

- **Processamento de Pagamentos:** O monFinTrack utiliza a infraestrutura da **Stripe** para o processamento seguro de assinaturas (planos Pro e Premium).
- **Isenção de Armazenamento:** Nós não coletamos, não processamos e **não armazenamos os números completos do seu cartão de crédito** ou código CVV em nossos servidores.
- **Cancelamento:** Assinaturas podem ser canceladas a qualquer momento. O acesso Premium permanecerá ativo até o fim do ciclo de faturamento atual. Não há reembolsos pró-rata.

### 5. Ética e Proibições

O usuário compromete-se a usar a plataforma de forma ética e estritamente legal. É proibido:

- Utilizar a plataforma para controle de recursos provenientes de crimes, corrupção ou lavagem de dinheiro.
- Fazer upload de documentos, recibos ou imagens ilícitas, abusivas ou que contenham malware no serviço de Scanner/Storage.
- Realizar engenharia reversa, abusar dos limites da API da IA (DDoS) ou explorar vulnerabilidades de software.

O monFinTrack reserva-se o direito de banir imediatamente contas que violem estas regras.

---

## PARTE II: POLÍTICA DE PRIVACIDADE

Esta política explica como tratamos seus dados em rigorosa conformidade com a **Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)** do Brasil.

### 1. Coleta e Estrutura de Dados

Coletamos apenas os dados essenciais para o fornecimento do SaaS:

- **Dados de Identidade:** Nome, E-mail e ID de autenticação (Firebase Auth).
- **Dados Financeiros:** Valores, descrições, categorias, orçamentos, dados básicos de dívidas e imagens de recibos.
- **Metadados:** Logs técnicos de acesso para segurança e controle de _rate limits_ (limite de uso da IA).

### 2. Tratamento de Dados por Inteligência Artificial (Google Gemini)

- **Processamento Efêmero:** Textos e imagens (recibos) são enviados à API Corporativa do Google Gemini exclusivamente para extração e processamento no momento da requisição.
- **Zero Treinamento:** Conforme as políticas de APIs corporativas do Google Cloud, **seus dados pessoais e financeiros não são utilizados para treinar modelos de Inteligência Artificial públicos.**

### 3. Segurança de Dados

Aplicamos rigorosos padrões de segurança:

- **Criptografia:** Dados em trânsito são protegidos via HTTPS (TLS/SSL).
- **Isolamento (Multitenancy):** A arquitetura do banco de dados (Firestore) garante regras de segurança rígidas, onde cada usuário só possui permissão de leitura/escrita em documentos que contenham seu próprio `user_id`.

### 4. Venda e Compartilhamento

- **Não vendemos, alugamos ou comercializamos seus dados sob nenhuma hipótese para bancos, seguradoras ou anunciantes.**
- Compartilhamos dados apenas com infraestruturas essenciais para o funcionamento do app (Google Cloud/Firebase para hospedagem e banco de dados; Stripe para pagamentos).

### 5. Seus Direitos (LGPD)

O monFinTrack garante o pleno exercício dos seus direitos como titular:

- **Acesso e Correção:** Você pode ver e alterar todos os seus dados pelo aplicativo.
- **Portabilidade:** Exportar suas transações a qualquer momento.
- **Direito ao Esquecimento:** Você pode solicitar ou executar a exclusão total da sua conta via painel de configurações. Esta ação apagará permanentemente seu registro no Auth, todos os seus documentos no Firestore e arquivos no Storage, sem chance de recuperação.

### 6. Atualizações

Esta política pode ser atualizada periodicamente. Mudanças substanciais que afetem o uso dos seus dados serão comunicadas na plataforma.

---

**Contato e Encarregado de Dados (DPO)**
Para exercer seus direitos da LGPD, relatar vulnerabilidades ou tirar dúvidas sobre pagamentos, entre em contato através da Central de Ajuda na plataforma ou via e-mail (se aplicável).
