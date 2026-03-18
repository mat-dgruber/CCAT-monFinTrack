import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { applyActionCode, getAuth, onAuthStateChanged } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { environment } from '../../../environments/environment';

// PrimeNG
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-email-verification',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    ButtonModule,
    ProgressSpinnerModule,
    RouterModule,
    SkeletonModule,
  ],
  templateUrl: './email-verification.html',
})
export class EmailVerification implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // Status da validação
  status = signal<'loading' | 'success' | 'error' | 'resending'>('loading');
  errorMessage = signal('');
  isLoggedIn = signal(false);
  hasPendingSubscription = signal(false);

  ngOnInit() {
    if (localStorage.getItem('pending_subscription')) {
      this.hasPendingSubscription.set(true);
    }
    // 1. Monitorar estado de autenticação para ver se já está verificado
    const app = initializeApp(environment.firebaseConfig);
    const auth = getAuth(app);

    onAuthStateChanged(auth, (user) => {
      this.isLoggedIn.set(!!user);
      if (user?.emailVerified && this.status() === 'loading') {
        console.log(
          'EmailVerification: Usuário já está verificado (via AuthState).',
        );
        this.status.set('success');
      }
    });

    // 2. Capturar o código da URL (Angular params e fallback para window.location)
    this.route.queryParams.subscribe((params) => {
      let actionCode = params['oobCode'];

      // Fallback 1: Angular Router query params snapshot
      if (!actionCode) {
        actionCode = this.route.snapshot.queryParams['oobCode'];
      }

      // Fallback 2: window.location.search
      if (!actionCode) {
        const urlParams = new URLSearchParams(window.location.search);
        actionCode = urlParams.get('oobCode');
      }

      // Fallback 3: window.location.hash (alguns fluxos de redirect usam hash)
      if (!actionCode && window.location.hash.includes('oobCode=')) {
        const hashParams = new URLSearchParams(
          window.location.hash.split('?')[1] ||
            window.location.hash.replace('#', ''),
        );
        actionCode = hashParams.get('oobCode');
        if (actionCode)
          console.log('EmailVerification: Código encontrado no HASH.');
      }

      // Fallback 4: Raw URL string search (Último recurso se tudo falhar e o search sumiu mas o href ainda tem)
      if (!actionCode && window.location.href.includes('oobCode=')) {
        const match = window.location.href.match(/[?&]oobCode=([^&#]+)/);
        actionCode = match ? match[1] : null;
        if (actionCode)
          console.log(
            'EmailVerification: Código encontrado via Regex no HREF.',
          );
      }

      if (actionCode) {
        console.log('EmailVerification: Código detectado!');
        this.verifyCode(actionCode);
      } else {
        console.log('EmailVerification: Nenhum código detectado até agora.');
        // Aguardamos 6 segundos (paciência extra) antes de desistir
        setTimeout(() => {
          if (this.status() === 'loading') {
            console.log(
              'EmailVerification: Código ausente após timeout final.',
            );
            this.status.set('error');
            this.errorMessage.set(
              'Código de verificação não encontrado na URL.',
            );
          }
        }, 6000);
      }
    });
  }

  async verifyCode(code: string) {
    const app = initializeApp(environment.firebaseConfig);
    const auth = getAuth(app);

    try {
      await applyActionCode(auth, code);
      console.log('EmailVerification: Código aplicado com sucesso.');
      this.status.set('success');
    } catch (error: any) {
      console.error('EmailVerification Trace Error:', error);

      // Lógica amigável: se falhar mas já estiver verificado, tratamos como sucesso
      // (Isso resolve o problema de links clicados duas vezes ou processados pelo Chrome/Mail pre-fetch)
      if (auth.currentUser?.emailVerified) {
        this.status.set('success');
      } else {
        // Pequeno delay para dar tempo ao Firebase Auth de atualizar se for o caso
        setTimeout(() => {
          if (auth.currentUser?.emailVerified) {
            this.status.set('success');
          } else {
            this.status.set('error');
            this.errorMessage.set(
              'Este link já foi utilizado ou está expirado. Tente fazer login e solicitar um novo se necessário.',
            );
          }
        }, 1500);
      }
    }
  }

  retry() {
    const urlParams = new URLSearchParams(window.location.search);
    const actionCode =
      urlParams.get('oobCode') || this.route.snapshot.queryParams['oobCode'];

    if (actionCode) {
      this.status.set('loading');
      this.verifyCode(actionCode);
    } else {
      // Se não tem código, o "Tentar Novamente" pode significar "Tentar detectar de novo" ou "Ir para login"
      // Vamos apenas logar por enquanto para diagnóstico
      console.log(
        'EmailVerification: Tentativa de re-verificação sem código na URL.',
      );
      if (this.isLoggedIn()) {
        this.status.set('error');
        this.errorMessage.set(
          'Não encontramos o código na URL. Deseja que enviemos um novo e-mail?',
        );
      } else {
        this.status.set('error');
        this.errorMessage.set('Código de verificação não encontrado na URL.');
      }
    }
  }

  async resendEmail() {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    this.status.set('resending');
    try {
      // Usamos a lógica do AuthService ou Firebase direto
      const { sendEmailVerification } = await import('firebase/auth');
      await sendEmailVerification(user);
      this.status.set('error'); // Volta para o estado de erro mas com mensagem de sucesso
      this.errorMessage.set(
        'Um novo e-mail foi enviado! Verifique sua caixa de entrada.',
      );
    } catch (error: any) {
      console.error('EmailVerification: Erro ao reenviar e-mail', error);
      this.status.set('error');
      this.errorMessage.set(
        'Erro ao reenviar e-mail. Tente novamente em instantes.',
      );
    }
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  continueToApp() {
    if (this.hasPendingSubscription()) {
      this.router.navigate(['/app/pricing']);
    } else {
      this.router.navigate(['/app']);
    }
  }
}
