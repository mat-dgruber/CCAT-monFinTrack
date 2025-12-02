import { Routes } from '@angular/router';
import { Home } from './components/home/home';
import { EmailVerification } from './components/email-verification/email-verification';
import { Terms } from './components/legal/terms/terms';
import { PrivacyPolicy } from './components/legal/privacy-policy/privacy-policy';
import { Settings } from './components/settings/settings';
import { AccountManager } from './components/account-manager/account-manager';
import { CategoryManager } from './components/category-manager/category-manager';
import { BudgetManager } from './components/budget-manager/budget-manager';
import { Dashboard } from './components/dashboard/dashboard';
import { TransactionManager } from './components/transaction-manager/transaction-manager';
import { AdvancedGraphicsComponent } from './pages/advanced-graphics/advanced-graphics.component';
import { FinancialCalendarComponent } from './components/financial-calendar/financial-calendar.component';
import { SubscriptionsDashboardComponent } from './components/subscriptions-dashboard/subscriptions-dashboard.component';

export const routes: Routes = [
    {
        path: '',
        component: Home,
        children: [
            { path: '', component: Dashboard },
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
    { path: '**', redirectTo: '' }
];