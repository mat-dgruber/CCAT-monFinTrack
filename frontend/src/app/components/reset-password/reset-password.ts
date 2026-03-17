import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  confirmPasswordReset,
  getAuth,
  verifyPasswordResetCode,
} from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { environment } from '../../../environments/environment';

// PrimeNG
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageService } from 'primeng/api';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    ProgressSpinnerModule,
    ToastModule,
    RouterModule,
  ],
  templateUrl: './reset-password.html',
  providers: [MessageService],
})
export class ResetPassword implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private messageService = inject(MessageService);

  status = signal<'loading' | 'form' | 'success' | 'error'>('loading');
  errorMessage = signal('');
  oobCode = signal<string | null>(null);
  email = signal<string | null>(null);

  form = this.fb.group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    {
      validators: (control: any) => {
        const pass = control.get('password')?.value;
        const confirm = control.get('confirmPassword')?.value;
        return pass === confirm ? null : { mismatch: true };
      },
    },
  );

  ngOnInit() {
    // 1. Capturar o código
    this.route.queryParams.subscribe((params) => {
      const code =
        params['oobCode'] || this.route.snapshot.queryParams['oobCode'];
      if (code) {
        this.oobCode.set(code);
        this.verifyCode(code);
      } else {
        // Fallback para window.location
        const urlParams = new URLSearchParams(window.location.search);
        const fbCode = urlParams.get('oobCode');
        if (fbCode) {
          this.oobCode.set(fbCode);
          this.verifyCode(fbCode);
        } else {
          this.status.set('error');
          this.errorMessage.set('Código de redefinição inválido ou ausente.');
        }
      }
    });
  }

  async verifyCode(code: string) {
    const app = initializeApp(environment.firebaseConfig);
    const auth = getAuth(app);

    try {
      const email = await verifyPasswordResetCode(auth, code);
      this.email.set(email);
      this.status.set('form');
    } catch (error: any) {
      console.error('ResetPassword code verification error:', error);
      this.status.set('error');
      this.errorMessage.set(
        'O link de redefinição expirou ou já foi utilizado.',
      );
    }
  }

  async onSubmit() {
    if (this.form.invalid || !this.oobCode()) return;

    this.status.set('loading');
    const newPassword = this.form.get('password')?.value;

    const app = initializeApp(environment.firebaseConfig);
    const auth = getAuth(app);

    try {
      await confirmPasswordReset(auth, this.oobCode()!, newPassword!);
      this.status.set('success');
      this.messageService.add({
        severity: 'success',
        summary: 'Sucesso',
        detail: 'Sua senha foi alterada com sucesso!',
      });
    } catch (error: any) {
      console.error('ResetPassword confirm error:', error);
      this.status.set('form');
      this.messageService.add({
        severity: 'error',
        summary: 'Erro',
        detail: 'Não foi possível alterar a senha. O link pode ter expirado.',
      });
    }
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}
