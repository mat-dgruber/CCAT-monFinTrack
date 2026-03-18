import {
  Component,
  inject,
  signal,
  computed,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';

// Animações
import {
  trigger,
  state,
  style,
  transition,
  animate,
} from '@angular/animations';

// PrimeNG
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageService } from 'primeng/api';
import { CheckboxModule } from 'primeng/checkbox';
import { ToastModule } from 'primeng/toast';
import { DividerModule } from 'primeng/divider';
import { DialogModule } from 'primeng/dialog';
import { InputMaskModule } from 'primeng/inputmask';

import { AuthService } from '../../services/auth.service';
import { MFAService } from '../../services/mfa.service';
import * as animeNamespace from 'animejs';

const anime = (animeNamespace as any).default || animeNamespace;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CardModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    ToastModule,
    DividerModule,
    DialogModule,
    CheckboxModule,
    InputMaskModule,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  animations: [
    trigger('slideFade', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-10px)', height: 0 }),
        animate(
          '300ms ease-out',
          style({ opacity: 1, transform: 'translateY(0)', height: '*' }),
        ),
      ]),
      transition(':leave', [
        animate(
          '200ms ease-in',
          style({ opacity: 0, transform: 'translateY(-10px)', height: 0 }),
        ),
      ]),
    ]),
  ],
})
export class Login implements AfterViewInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private messageService = inject(MessageService);
  private mfaService = inject(MFAService);
  private router = inject(Router);

  isRegisterMode = signal(false);
  isLoading = signal(false);
  showForgotPassword = signal(false);
  resetEmail = '';

  // MFA
  showMfaDialog = signal(false);
  mfaToken = signal('');

  currentYear = new Date().getFullYear();

  // --- Definição do Formulário ---
  form = this.fb.group(
    {
      name: [''],
      phone: [''],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: [''],
      termsAccepted: [false],
    },
    { validators: this.passwordMatchValidator },
  );

  ngAfterViewInit() {
    this.animateEntrance();
  }

  private animateEntrance() {
    anime
      .timeline({
        easing: 'easeOutExpo',
      })
      .add({
        targets: '.side-panel',
        translateX: [-100, 0],
        opacity: [0, 1],
        duration: 1200,
      })
      .add(
        {
          targets: '.form-container',
          translateX: [100, 0],
          opacity: [0, 1],
          duration: 1200,
        },
        '-=1200',
      )
      .add(
        {
          targets: '.animate-item',
          translateY: [20, 0],
          opacity: [0, 1],
          scale: [0.98, 1],
          delay: anime.stagger(80),
          duration: 1000,
        },
        '-=600',
      );
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirm = control.get('confirmPassword')?.value;
    if (!password || !confirm) return null;
    return password === confirm ? null : { mismatch: true };
  }

  get showPasswordRequirements() {
    const passControl = this.form.get('password');
    return (
      this.isRegisterMode() &&
      (passControl?.dirty ||
        passControl?.touched ||
        this.passwordValue.length > 0)
    );
  }

  get passwordValue() {
    return this.form.get('password')?.value || '';
  }
  get hasMinLength() {
    return this.passwordValue.length >= 8;
  }
  get hasUpper() {
    return /[A-Z]/.test(this.passwordValue);
  }
  get hasLower() {
    return /[a-z]/.test(this.passwordValue);
  }
  get hasNumber() {
    return /\d/.test(this.passwordValue);
  }
  get hasSpecial() {
    return /[!@#$%^&*(),.?":{}|<>]/.test(this.passwordValue);
  }

  get isPasswordStrong() {
    return (
      this.hasMinLength &&
      this.hasUpper &&
      this.hasLower &&
      this.hasNumber &&
      this.hasSpecial
    );
  }

  toggleMode() {
    // Animação de saída antes de trocar o modo
    anime({
      targets: '.form-content',
      opacity: [1, 0],
      scale: [1, 0.98],
      translateY: [0, 10],
      duration: 300,
      easing: 'easeInQuad',
      complete: () => {
        this.isRegisterMode.update((v) => !v);
        this.form.reset();

        const nameControl = this.form.get('name');
        const phoneControl = this.form.get('phone');
        const confirmControl = this.form.get('confirmPassword');
        const termsControl = this.form.get('termsAccepted');

        if (this.isRegisterMode()) {
          nameControl?.setValidators([
            Validators.required,
            Validators.minLength(3),
          ]);
          phoneControl?.setValidators([
            Validators.required,
            Validators.minLength(10),
          ]);
          confirmControl?.setValidators([Validators.required]);
          termsControl?.setValidators([Validators.requiredTrue]);
        } else {
          nameControl?.clearValidators();
          phoneControl?.clearValidators();
          confirmControl?.clearValidators();
          termsControl?.clearValidators();
        }
        nameControl?.updateValueAndValidity();
        phoneControl?.updateValueAndValidity();
        confirmControl?.updateValueAndValidity();
        termsControl?.updateValueAndValidity();

        // Animação de entrada do novo modo
        // Pequeno delay para o Angular renderizar o @if no DOM
        setTimeout(() => {
          anime
            .timeline({
              easing: 'easeOutExpo',
            })
            .add({
              targets: '.form-content',
              opacity: [0, 1],
              scale: [0.98, 1],
              translateY: [10, 0],
              duration: 600,
            })
            .add(
              {
                targets: '.animate-item',
                translateY: [20, 0],
                opacity: [0, 1],
                scale: [0.98, 1],
                delay: anime.stagger(60),
                duration: 800,
              },
              '-=400',
            );
        }, 50);
      },
    });
  }

  async onSubmit() {
    if (this.form.invalid) return;

    if (this.isRegisterMode() && !this.isPasswordStrong) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Senha Fraca',
        detail: 'Sua senha não atende aos requisitos.',
      });
      return;
    }

    this.isLoading.set(true);
    const { email, password, name, phone } = this.form.value;

    try {
      if (this.isRegisterMode()) {
        await this.authService.register(email!, password!, name!, phone!);
        this.messageService.add({
          severity: 'success',
          summary: 'Conta Criada!',
          detail:
            'Enviamos um email de confirmação. Verifique sua caixa de entrada antes de logar.',
          life: 8000,
        });
        this.toggleMode();
      } else {
        await this.authService.login(email!, password!);
        try {
          const mfaStatus = await this.mfaService.checkMFAStatus().toPromise();
          if (mfaStatus?.enabled) {
            this.showMfaDialog.set(true);
            this.isLoading.set(false);
            return;
          }
        } catch (e) {}
        this.router.navigate(['/app']);
      }
    } catch (error: any) {
      console.error('Login error detail:', error);
      let msg = 'Ocorreu um erro inesperado.';
      const errorStr = error?.toString() || '';
      const errorCode = error?.code || '';

      if (
        errorCode === 'auth/invalid-credential' ||
        errorCode === 'auth/wrong-password' ||
        errorStr.includes('invalid-credential') ||
        errorStr.includes('wrong-password')
      ) {
        msg = 'E-mail ou senha incorretos.';
      } else if (
        errorCode === 'auth/user-not-found' ||
        errorStr.includes('user-not-found')
      ) {
        msg = 'Este e-mail não está cadastrado em nossa base.';
      } else if (
        errorCode === 'auth/email-already-in-use' ||
        errorStr.includes('email-already-in-use')
      ) {
        msg = 'Este e-mail já está sendo utilizado em outra conta.';
      } else if (
        errorCode === 'auth/network-request-failed' ||
        errorStr.includes('network-request-failed')
      ) {
        msg = 'Falha de conexão. Verifique sua internet.';
      } else if (
        error.message === 'email-not-verified' ||
        errorStr.includes('E-mail não verificado')
      ) {
        msg =
          'Seu e-mail ainda não foi verificado. Por favor, cheque sua caixa de entrada e spam.';
      } else if (errorCode === 'auth/too-many-requests') {
        msg =
          'Muitas tentativas malsucedidas. Sua conta foi temporariamente bloqueada. Tente mais tarde ou redefina sua senha.';
      } else if (error.status === 401) {
        msg = 'Sessão inválida ou credenciais incorretas.';
      } else if (error.status === 403) {
        msg = 'Você não tem permissão para acessar este recurso.';
      } else if (error.message) {
        msg = error.message;
      }

      this.messageService.add({
        key: 'main-toast',
        severity: 'error',
        summary: 'Atenção',
        detail: msg,
        life: 5000,
      });
    } finally {
      this.isLoading.set(false);
    }
  }

  async sendResetLink() {
    if (!this.resetEmail || !this.resetEmail.includes('@')) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Atenção',
        detail: 'Digite um e-mail válido.',
      });
      return;
    }
    this.isLoading.set(true);
    try {
      await this.authService.resetPassword(this.resetEmail);
      this.messageService.add({
        severity: 'success',
        summary: 'E-mail Enviado',
        detail: 'Verifique sua caixa de entrada para redefinir a senha.',
      });
      this.showForgotPassword.set(false);
      this.resetEmail = '';
    } catch (error: any) {
      console.error(error);
      let msg = 'Erro ao enviar e-mail.';
      if (error.code === 'auth/user-not-found') msg = 'E-mail não cadastrado.';
      this.messageService.add({
        severity: 'error',
        summary: 'Erro',
        detail: msg,
      });
    } finally {
      this.isLoading.set(false);
    }
  }

  verifyMfaLogin() {
    if (this.mfaToken().length !== 6) return;
    this.isLoading.set(true);
    this.mfaService.verifyLogin(this.mfaToken()).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Sucesso',
          detail: 'Login realizado com sucesso!',
        });
        this.showMfaDialog.set(false);
        this.router.navigate(['/app']);
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: 'Código MFA inválido.',
        });
        this.isLoading.set(false);
      },
    });
  }
}
