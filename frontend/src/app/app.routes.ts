import { Routes } from '@angular/router';
import { Home } from './components/home/home';
import { Login } from './components/login/login';
import { EmailVerification } from './components/email-verification/email-verification';
import { Terms } from './components/legal/terms/terms';
import { PrivacyPolicy } from './components/legal/privacy-policy/privacy-policy';
import { Contact } from './components/legal/contact/contact';
import { Settings } from './components/settings/settings';
import { AccountManager } from './components/account-manager/account-manager';
import { CategoryManager } from './components/category-manager/category-manager';
import { BudgetManager } from './components/budget-manager/budget-manager';
import { Dashboard } from './components/dashboard/dashboard';
import { TransactionManager } from './components/transaction-manager/transaction-manager';
import { AdvancedGraphicsComponent } from './pages/advanced-graphics/advanced-graphics.component';
import { FinancialCalendarComponent } from './components/financial-calendar/financial-calendar.component';
import { SubscriptionsDashboardComponent } from './components/subscriptions-dashboard/subscriptions-dashboard.component';
import { authGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest-guard';
import { LandingPage } from './components/landing-page/landing-page';

export const routes: Routes = [
  {
    path: '',
    component: LandingPage,
    canActivate: [guestGuard],
    title: 'monFinTrack - Seu Assistente Financeiro com IA',
    data: {
      description:
        'Organize suas finanças com o poder da Inteligência Artificial. Controle gastos, analise dívidas e receba insights personalizados.',
    },
  },
  {
    path: 'login',
    component: Login,
    canActivate: [guestGuard],
    title: 'Login - monFinTrack',
    data: {
      description:
        'Acesse sua conta no monFinTrack e retome o controle das suas finanças.',
    },
  },
  {
    path: 'app',
    component: Home,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        component: Dashboard,
        title: 'Dashboard',
        data: {
          description:
            'Visão geral das suas finanças: saldo, gastos recentes e métricas rápidas.',
          animation: 1,
        },
      },
      { path: 'dashboard', redirectTo: '', pathMatch: 'full' },
      {
        path: 'settings',
        component: Settings,
        title: 'Configurações',
        data: {
          description:
            'Personalize sua experiência no monFinTrack: perfil, notificações e preferências.',
          animation: 13,
        },
      },
      {
        path: 'accounts',
        component: AccountManager,
        title: 'Gerenciar Contas',
        data: {
          description:
            'Controle suas contas bancárias, carteiras e cartões em um só lugar.',
          animation: 6,
        },
      },
      {
        path: 'categories',
        component: CategoryManager,
        title: 'Categorias',
        data: {
          description:
            'Organize seus gastos e ganhos com categorias personalizadas.',
          animation: 5,
        },
      },
      {
        path: 'transactions',
        component: TransactionManager,
        title: 'Transações',
        data: {
          description:
            'Histórico detalhado de todas as suas entradas e saídas financeiras.',
          animation: 2,
        },
      },
      {
        path: 'calendar',
        component: FinancialCalendarComponent,
        title: 'Calendário Financeiro',
        data: {
          description:
            'Visualize seus vencimentos e recebimentos em uma visão mensal prática.',
          animation: 11,
        },
      },
      {
        path: 'subscriptions',
        component: SubscriptionsDashboardComponent,
        title: 'Assinaturas e Recorrências',
        data: {
          description:
            'Acompanhe seus serviços de streaming, planos e custos recorrentes.',
          animation: 3,
        },
      },
      {
        path: 'advanced-graphics',
        component: AdvancedGraphicsComponent,
        title: 'Gráficos Avançados',
        data: {
          description:
            'Análises visuais profundas sobre sua evolução financeira e padrões de gastos.',
          animation: 10,
        },
      },
      {
        path: 'budgets',
        component: BudgetManager,
        title: 'Planejamento de Orçamentos',
        data: {
          description:
            'Defina limites de gastos e crie metas para economizar com inteligência.',
          animation: 7,
        },
      },
      {
        path: 'invoices',
        loadComponent: () =>
          import('./components/invoice-dashboard/invoice-dashboard').then(
            (m) => m.InvoiceDashboard,
          ),
        canActivate: [authGuard],
        title: 'Faturas de Cartão',
        data: {
          description:
            'Gerencie suas faturas de cartão de crédito e evite juros indesejados.',
          animation: 8,
        },
      },
      {
        path: 'import',
        loadComponent: () =>
          import('./components/import-transactions/import-transactions.component').then(
            (m) => m.ImportTransactionsComponent,
          ),
        title: 'Importar Dados',
        data: {
          description:
            'Importe extratos bancários de forma rápida para manter seu controle em dia.',
          animation: 12,
        },
      },
      {
        path: 'debt-planner',
        loadComponent: () =>
          import('./components/debt-planner/debt-planner.component').then(
            (m) => m.DebtPlannerComponent,
          ),
        title: 'Planejador de Dívidas',
        data: {
          description:
            'Estratégias para quitação de dívidas e reconquista da sua liberdade financeira.',
          animation: 4,
        },
      },
      {
        path: 'cost-of-living',
        loadComponent: () =>
          import('./components/cost-of-living/cost-of-living.component').then(
            (m) => m.CostOfLivingComponent,
          ),
        title: 'Custo de Vida',
        data: {
          description:
            'Análise detalhada do seu custo de vida por localidade ou categoria.',
          animation: 9,
        },
      },
      {
        path: 'pricing',
        loadComponent: () =>
          import('./components/pricing/pricing.component').then(
            (m) => m.PricingComponent,
          ),
        title: 'Planos e Preços',
        data: {
          description:
            'Conheça o monFinTrack Premium e desbloqueie recursos exclusivos.',
          animation: 14,
        },
      },
    ],
  },
  {
    path: 'verify-email',
    component: EmailVerification,
    title: 'Verificar E-mail',
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./components/reset-password/reset-password').then(
        (m) => m.ResetPassword,
      ),
    title: 'Redefinir Senha',
  },
  {
    path: 'terms',
    component: Terms,
    title: 'Termos de Uso',
    data: { description: 'Termos e condições de uso do monFinTrack.' },
  },
  {
    path: 'privacy-policy',
    component: PrivacyPolicy,
    title: 'Política de Privacidade',
    data: {
      description: 'Saiba como protegemos seus dados e sua privacidade.',
    },
  },
  {
    path: 'contact',
    component: Contact,
    title: 'Contato',
    data: {
      description:
        'Precisa de ajuda? Entre em contato com o suporte do monFinTrack.',
    },
  },
  { path: 'dashboard', redirectTo: 'app/dashboard', pathMatch: 'full' },
  { path: 'transactions', redirectTo: 'app/transactions', pathMatch: 'full' },
  { path: 'subscriptions', redirectTo: 'app/subscriptions', pathMatch: 'full' },
  { path: 'debt-planner', redirectTo: 'app/debt-planner', pathMatch: 'full' },
  { path: 'accounts', redirectTo: 'app/accounts', pathMatch: 'full' },
  { path: 'categories', redirectTo: 'app/categories', pathMatch: 'full' },
  { path: 'budgets', redirectTo: 'app/budgets', pathMatch: 'full' },
  { path: 'invoices', redirectTo: 'app/invoices', pathMatch: 'full' },
  { path: 'settings', redirectTo: 'app/settings', pathMatch: 'full' },
  { path: 'cost-of-living', redirectTo: 'app/cost-of-living', pathMatch: 'full' },
  { path: 'advanced-graphics', redirectTo: 'app/advanced-graphics', pathMatch: 'full' },
  { path: 'pricing', redirectTo: 'app/pricing', pathMatch: 'full' },
  { path: 'transaction', redirectTo: 'app/transactions' },
  { path: '**', redirectTo: '' },
];
