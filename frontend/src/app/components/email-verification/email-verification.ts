import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { applyActionCode, getAuth } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { environment } from '../../../environments/environment';

// PrimeNG
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

@Component({
  selector: 'app-email-verification',
  standalone: true,
  imports: [CommonModule, CardModule, ButtonModule, ProgressSpinnerModule, RouterModule],
  templateUrl: './email-verification.html'
})
export class EmailVerification implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  
  // Status da validação
  status = signal<'loading' | 'success' | 'error'>('loading');
  errorMessage = signal('');

  ngOnInit() {
    // Captura o código da URL (enviado pelo email)
    const actionCode = this.route.snapshot.queryParams['oobCode'];

    if (!actionCode) {
      this.status.set('error');
      this.errorMessage.set('Código de verificação inválido ou ausente.');
      return;
    }

    this.verifyCode(actionCode);
  }

  async verifyCode(code: string) {
    const app = initializeApp(environment.firebaseConfig);
    const auth = getAuth(app);

    try {
      // Chama o Firebase para confirmar que o código é real
      await applyActionCode(auth, code);
      this.status.set('success');
    } catch (error: any) {
      console.error(error);
      this.status.set('error');
      this.errorMessage.set('O link expirou ou já foi utilizado.');
    }
  }

  goToLogin() {
    this.router.navigate(['/']);
  }
}