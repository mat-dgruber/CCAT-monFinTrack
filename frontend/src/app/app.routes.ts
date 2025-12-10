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
    component: Login
  },
  {
    path: '',
    component: Home,
    canActivate: [authGuard], // Protect the home shell
    children: [
      { path: '', component: Dashboard },
      { path: 'dashboard', redirectTo: '', pathMatch: 'full' },
      { path: 'settings', component: Settings },
      { path: 'categories', component: CategoryManager },
      { path: 'transactions', component: TransactionManager },
      { path: 'calendar', component: FinancialCalendarComponent },
      { path: 'subscriptions', component: SubscriptionsDashboardComponent },
      { path: 'advanced-graphics', component: AdvancedGraphicsComponent }
    ]
  },
  { path: 'verify-email', component: EmailVerification },
  { path: 'terms', component: Terms },
  { path: 'privacy-policy', component: PrivacyPolicy },
  { path: 'contact', component: Contact },
  { path: '**', redirectTo: '' }
];
