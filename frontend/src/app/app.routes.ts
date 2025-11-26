import { Routes } from '@angular/router';
import { Home } from './components/home/home';
import { EmailVerification } from './components/email-verification/email-verification';
import { Terms } from './components/legal/terms/terms';
import { PrivacyPolicy } from './components/legal/privacy-policy/privacy-policy';
import { Settings } from './components/settings/settings';
import { TransactionList } from './components/transaction-list/transaction-list';
import { AccountManager } from './components/account-manager/account-manager';
import { CategoryManager } from './components/category-manager/category-manager';
import { BudgetManager } from './components/budget-manager/budget-manager';

export const routes: Routes = [
    { path: '', component: Home },
    { path: 'verify-email', component: EmailVerification },
    { path: 'terms', component: Terms },
    { path: 'privacy-policy', component: PrivacyPolicy },
    { path: 'settings', component: Settings },
    { path: '**', redirectTo: '' }
];