import { Routes } from '@angular/router';
import { Home } from './components/home/home';
import { EmailVerification } from './components/email-verification/email-verification';
import { AdvancedCharts } from './components/advanced-charts/advanced-charts';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
    { path: '', component: Home },
    { path: 'verify-email', component: EmailVerification },
    { path: 'advanced-charts', component: AdvancedCharts, canActivate: [authGuard] },
    { path: '**', redirectTo: '' }
];
