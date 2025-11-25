import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';

// Animações  
import { trigger, state, style, transition, animate } from '@angular/animations';

// PrimeNG
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { DividerModule } from 'primeng/divider'; // Opcional, para visual
import { DialogModule } from 'primeng/dialog';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, CardModule, ButtonModule, 
    InputTextModule, PasswordModule, ToastModule, DividerModule, DialogModule
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  animations: [
    trigger('slideFade', [
      // Estado "void" (quando não existe no DOM)
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-10px)', height: 0 }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)', height: '*' }))
      ]),
      // Estado de saída (opcional, se quiser que suma suave também)
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(-10px)', height: 0 }))
      ])
    ])
  ]
})

export class Login {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private messageService = inject(MessageService);

  isRegisterMode = signal(false);
  isLoading = signal(false);
  showForgotPassword = signal(false);
  resetEmail = '';

  // --- Definição do Formulário ---
  form = this.fb.group({
    name: [''], // Apenas para cadastro
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: [''] // Apenas para cadastro
  }, { validators: this.passwordMatchValidator }); // Validador do Grupo

  // --- Validador de "Senhas Iguais" ---
  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirm = control.get('confirmPassword')?.value;
    
    // Só valida se estivermos no modo registro e os campos tiverem valor
    if (!password || !confirm) return null;
    
    return password === confirm ? null : { mismatch: true };
  }

  get showPasswordRequirements() {
    const passControl = this.form.get('password');
    // Mostra se: Está no modo cadastro E (o campo foi tocado OU já tem algum valor digitado)
    return this.isRegisterMode() && (passControl?.dirty || passControl?.touched || this.passwordValue.length > 0);
  }

  // --- Helpers Visuais de Senha (Signals Computados nâo funcionam bem com form reativo direto, vamos usar getters simples) ---
  get passwordValue() { return this.form.get('password')?.value || ''; }

  // Regras Individuais (Retornam true se passar)
  get hasMinLength() { return this.passwordValue.length >= 8; }
  get hasUpper() { return /[A-Z]/.test(this.passwordValue); }
  get hasLower() { return /[a-z]/.test(this.passwordValue); }
  get hasNumber() { return /\d/.test(this.passwordValue); }
  get hasSpecial() { return /[!@#$%^&*(),.?":{}|<>]/.test(this.passwordValue); }

  // Valida se a senha atende TODOS os requisitos
  get isPasswordStrong() {
      return this.hasMinLength && this.hasUpper && this.hasLower && this.hasNumber && this.hasSpecial;
  }

  toggleMode() {
    this.isRegisterMode.update(v => !v);
    this.form.reset();
    
    // Ajusta validadores dinamicamente
    const nameControl = this.form.get('name');
    const confirmControl = this.form.get('confirmPassword');

    if (this.isRegisterMode()) {
        nameControl?.setValidators([Validators.required, Validators.minLength(3)]);
        confirmControl?.setValidators([Validators.required]);
    } else {
        nameControl?.clearValidators();
        confirmControl?.clearValidators();
    }
    nameControl?.updateValueAndValidity();
    confirmControl?.updateValueAndValidity();
  }

  async onSubmit() {
    if (this.form.invalid) return;
    
    // Segurança extra: no cadastro, senha TEM que ser forte
    if (this.isRegisterMode() && !this.isPasswordStrong) {
        this.messageService.add({ severity: 'warn', summary: 'Senha Fraca', detail: 'Sua senha não atende aos requisitos.' });
        return;
    }

    this.isLoading.set(true);
    const { email, password, name } = this.form.value;

    try {
      if (this.isRegisterMode()) {
        // CADASTRO
        await this.authService.register(email!, password!, name!);
        
        this.messageService.add({ 
            severity: 'success', 
            summary: 'Conta Criada!', 
            detail: 'Enviamos um email de confirmação. Verifique sua caixa de entrada antes de logar.', 
            life: 8000 
        });
        
        // Volta para tela de login
        this.toggleMode(); 

      } else {
        // LOGIN
        await this.authService.login(email!, password!);
        // Se passar daqui, o AuthStateChanged no app.ts vai redirecionar
      }
    } catch (error: any) {
      console.error(error);
      let msg = 'Ocorreu um erro.';
      
      if (error.message === 'email-not-verified') msg = 'Por favor, verifique seu email antes de entrar.';
      else if (error.code === 'auth/invalid-credential') msg = 'Email ou senha incorretos.';
      else if (error.code === 'auth/email-already-in-use') msg = 'Este email já está em uso.';

      this.messageService.add({ severity: 'error', summary: 'Atenção', detail: msg });
    } finally {
      this.isLoading.set(false);
    }
  }

  async sendResetLink() {
    if (!this.resetEmail || !this.resetEmail.includes('@')) {
        this.messageService.add({ severity: 'warn', summary: 'Atenção', detail: 'Digite um e-mail válido.' });
        return;
    }

    this.isLoading.set(true);
    
    try {
        await this.authService.resetPassword(this.resetEmail);
        this.messageService.add({ 
            severity: 'success', 
            summary: 'E-mail Enviado', 
            detail: 'Verifique sua caixa de entrada para redefinir a senha.' 
        });
        this.showForgotPassword.set(false);
        this.resetEmail = ''; // Limpa o campo
    } catch (error: any) {
        console.error(error);
        let msg = 'Erro ao enviar e-mail.';
        if (error.code === 'auth/user-not-found') msg = 'E-mail não cadastrado.';
        this.messageService.add({ severity: 'error', summary: 'Erro', detail: msg });
    } finally {
        this.isLoading.set(false);
    }
  }
}