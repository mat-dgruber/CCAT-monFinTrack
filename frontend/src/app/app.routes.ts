import { Routes } from '@angular/router';
import { Home } from './components/home/home';
import { Login } from './components/login/login'; // Import login
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
import { authGuard } from './guards/auth.guard'; // Import guard

export const routes: Routes = [
  {
    path: 'login',
    component: Login,
    title: 'Login',
    data: {
      description:
        'Acesse sua conta no monFinTrack e retome o controle das suas finanças.',
    },
  },
  {
    path: '',
    component: Home,
    canActivate: [authGuard], // Protect the home shell
    children: [
      {
        path: '',
        component: Dashboard,
        title: 'Dashboard',
        data: {
          description:
            'Visão geral das suas finanças: saldo, gastos recentes e métricas rápidas.',
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
        },
      },
      {
        path: 'accounts',
        component: AccountManager,
        title: 'Gerenciar Contas',
        data: {
          description:
            'Controle suas contas bancárias, carteiras e cartões em um só lugar.',
        },
      },
      {
        path: 'categories',
        component: CategoryManager,
        title: 'Categorias',
        data: {
          description:
            'Organize seus gastos e ganhos com categorias personalizadas.',
        },
      },
      {
        path: 'transactions',
        component: TransactionManager,
        title: 'Transações',
        data: {
          description:
            'Histórico detalhado de todas as suas entradas e saídas financeiras.',
        },
      },
      {
        path: 'calendar',
        component: FinancialCalendarComponent,
        title: 'Calendário Financeiro',
        data: {
          description:
            'Visualize seus vencimentos e recebimentos em uma visão mensal prática.',
        },
      },
      {
        path: 'subscriptions',
        component: SubscriptionsDashboardComponent,
        title: 'Assinaturas e Recorrências',
        data: {
          description:
            'Acompanhe seus serviços de streaming, planos e custos recorrentes.',
        },
      },
      {
        path: 'advanced-graphics',
        component: AdvancedGraphicsComponent,
        title: 'Gráficos Avançados',
        data: {
          description:
            'Análises visuais profundas sobre sua evolução financeira e padrões de gastos.',
        },
      },
      {
        path: 'budgets',
        component: BudgetManager,
        title: 'Planejamento de Orçamentos',
        data: {
          description:
            'Defina limites de gastos e crie metas para economizar com inteligência.',
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
  { path: 'transaction', redirectTo: 'transactions' },
  { path: '**', redirectTo: '' },
];
