import { Routes } from '@angular/router';
import { Login } from './components/login/login';
import { EmailVerification } from './components/email-verification/email-verification'; // <--- Importe

export const routes: Routes = [
    { path: '', component: Login }, // Ou App se tiver logado (o app.html gerencia isso)
    { path: 'verify-email', component: EmailVerification }, // <--- Nova Rota
    { path: '**', redirectTo: '' }
];