import { Routes } from '@angular/router';
import { Home } from './components/home/home';
import { EmailVerification } from './components/email-verification/email-verification'; // <--- Importe

export const routes: Routes = [
    { path: '', component: Home }, // Ou App se tiver logado (o app.html gerencia isso)
    { path: 'verify-email', component: EmailVerification }, // <--- Nova Rota
    { path: '**', redirectTo: '' }
];