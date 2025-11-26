import { Routes } from '@angular/router';
import { Home } from './components/home/home';
import { EmailVerification } from './components/email-verification/email-verification';
import { AdvancedGraphics } from './components/advanced-graphics/advanced-graphics';

export const routes: Routes = [
    { path: '', component: Home },
    { path: 'verify-email', component: EmailVerification },
    { path: 'advanced-graphics', component: AdvancedGraphics },
    { path: '**', redirectTo: '' }
];