import { Component, inject, signal, computed } from '@angular/core'; // Force rebuild
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
// import { ThemeService } from '../../services/theme.service';
import { UserPreferenceService } from '../../services/user-preference.service';
import { MFAService } from '../../services/mfa.service';
import { AIService } from '../../services/ai.service';
import { UserPreference } from '../../models/user-preference.model';

// PrimeNG Imports
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { TagModule } from 'primeng/tag';
import { AvatarModule } from 'primeng/avatar';
import { FileUploadModule } from 'primeng/fileupload';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ProgressBarModule } from 'primeng/progressbar';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { PwaService } from '../../services/pwa.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.html',
  styleUrls: ['./settings.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    ToggleSwitchModule,
    ToastModule,
    ConfirmDialogModule,
    SelectModule,
    DatePickerModule,
    TagModule,
    AvatarModule,
    AvatarModule,
    FileUploadModule,
    DialogModule,
    TooltipModule,
    RouterModule,
    ProgressBarModule,
    ProgressSpinnerModule
  ],
  providers: [MessageService]
})
export class Settings {
  auth = inject(AuthService);
  // themeService = inject(ThemeService); // Removed in favor of UserPreferenceService
  router = inject(Router);
  messageService = inject(MessageService);
  confirmationService = inject(ConfirmationService);

  preferenceService = inject(UserPreferenceService);
  mfaService = inject(MFAService);
  pwaService = inject(PwaService);
  aiService = inject(AIService);

  preferences: UserPreference | null = null;
  wakeLockEnabled = signal(false);
  
  // AI Limits
  aiLimits = signal<any>(null);

  // Computed signal for profile image
  profileImageUrl = computed(() => {
    return this.preferenceService.getProfileImageUrl(this.preferences?.profile_image_url);
  });


  displayName = signal('');
  email = signal('');

  // MFA
  mfaEnabled = signal(false);
  showMfaSetupDialog = signal(false);
  mfaSecret = signal('');
  qrCodeUrl = signal('');
  mfaToken = signal('');

  // Profile
  birthday = signal<Date | null>(null);
  selectedTimezone = signal<string>('Europe/Paris');
  timezones = [
    { label: 'Europe/Paris', value: 'Europe/Paris' },
    { label: 'America/New_York', value: 'America/New_York' },
    { label: 'Asia/Tokyo', value: 'Asia/Tokyo' },
    { label: 'America/Sao_Paulo', value: 'America/Sao_Paulo' }
  ];

  // Appearance
  selectedTheme = signal<'light' | 'dark' | 'system' | 'capycro'>('system');
  themeOptions = [
    { label: 'Claro', value: 'light' },
    { label: 'Escuro', value: 'dark' },
    // { label: 'CapyCro', value: 'capycro' },
    { label: 'Sistema', value: 'system' }
  ];

  // Tithes & Offerings
  tithesEnabled = signal(false);
  defaultTithePct = signal(10);
  defaultOfferingPct = signal(5);
  autoApplyTithe = signal(false);
  autoApplyOffering = signal(false);

  // Subscription (Test Mode)
  selectedTier = signal<'free' | 'pro' | 'premium'>('free');
  tierOptions = [
      { label: 'Free (Grátis)', value: 'free' },
      { label: 'Pro (Intermediário)', value: 'pro' },
      { label: 'Premium (Completo)', value: 'premium' }
  ];

  constructor() {
    // Initialize with current user data
    const user = this.auth.currentUser();
    if (user) {
      this.displayName.set(user.displayName || '');
      this.email.set(user.email || '');
    }

    // Sync local state with service
    // this.selectedTheme.set(this.themeService.darkMode() ? 'dark' : 'light'); // Removed

    this.preferenceService.preferences$.subscribe(prefs => {
      this.preferences = prefs;
      if (prefs) {
        this.selectedTheme.set(prefs.theme);
        if (prefs.birthday) this.birthday.set(new Date(prefs.birthday));
        if (prefs.timezone) this.selectedTimezone.set(prefs.timezone);

        // Tithes
        this.tithesEnabled.set(!!prefs.enable_tithes_offerings);
        this.defaultTithePct.set(prefs.default_tithe_percentage ?? 10);
        this.defaultOfferingPct.set(prefs.default_offering_percentage ?? 5);
        this.autoApplyTithe.set(!!prefs.auto_apply_tithe);
        this.autoApplyTithe.set(!!prefs.auto_apply_tithe);
        this.autoApplyOffering.set(!!prefs.auto_apply_offering);
        
        // Tier
        this.selectedTier.set(prefs.subscription_tier || 'free');
      }
    });

    this.checkMfaStatus();
    this.loadAiLimits();
  }

  loadAiLimits() {
      this.aiService.getLimits().subscribe({
          next: (res) => this.aiLimits.set(res),
          error: () => console.error('Failed to load AI limits')
      });
  }

  onTithesChange() {
    if (this.preferences) {
        this.preferenceService.updatePreferences({
            enable_tithes_offerings: this.tithesEnabled()
        }).subscribe();
    }
  }

  onTitheSettingsChange() {
      if (this.preferences) {
          this.preferenceService.updatePreferences({
              default_tithe_percentage: this.defaultTithePct(),
              default_offering_percentage: this.defaultOfferingPct(),
              auto_apply_tithe: this.autoApplyTithe(),
              auto_apply_offering: this.autoApplyOffering()
          }).subscribe();
      }
  }

  checkMfaStatus() {
    this.mfaService.checkMFAStatus().subscribe({
      next: (res) => this.mfaEnabled.set(res.enabled),
      error: () => this.mfaEnabled.set(false)
    });
  }

  startMfaSetup() {
    this.mfaService.setupMFA().subscribe({
      next: (res) => {
        this.mfaSecret.set(res.secret);
        this.qrCodeUrl.set(res.qr_code);
        this.showMfaSetupDialog.set(true);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao iniciar setup MFA' });
      }
    });
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      this.messageService.add({ severity: 'success', summary: 'Copiado', detail: 'Código copiado para a área de transferência!' });
    }, () => {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao copiar código.' });
    });
  }

  confirmEnableMFA() {
    if (!this.mfaToken()) return;

    this.mfaService.enableMFA(this.mfaSecret(), this.mfaToken()).subscribe({
      next: () => {
        this.mfaEnabled.set(true);
        this.showMfaSetupDialog.set(false);
        this.mfaToken.set('');
        this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'MFA ativado com sucesso!' });
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Código inválido' });
      }
    });
  }

  disableMFA() {
    this.confirmationService.confirm({
      message: 'Tem certeza que deseja desativar o MFA? Sua conta ficará menos segura.',
      header: 'Confirmar Ação',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Desativar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text p-button-secondary',
      accept: () => {
        this.mfaService.disableMFA().subscribe({
          next: () => {
            this.mfaEnabled.set(false);
            this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'MFA desativado' });
          },
          error: () => {
            this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao desativar MFA' });
          }
        });
      }
    });
  }

  async updateProfile() {
    try {
      // 1. Update Firebase Profile (Display Name)
      if (this.displayName() !== this.auth.currentUser()?.displayName) {
        await this.auth.updateProfileData(this.displayName());
      }

      // 2. Update Preferences (Birthday, Timezone)
      if (this.preferences) {
        const updates: any = {};
        if (this.birthday()) updates.birthday = this.birthday()?.toISOString();
        if (this.selectedTimezone()) updates.timezone = this.selectedTimezone();

        if (Object.keys(updates).length > 0) {
          this.preferenceService.updatePreferences(updates).subscribe();
        }
      }

      this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Perfil atualizado com sucesso' });
    } catch (error) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao atualizar perfil' });
    }
  }

  async verifyEmail() {
    try {
      await this.auth.sendVerificationEmail();
      this.messageService.add({ severity: 'success', summary: 'Enviado', detail: 'Email de verificação enviado' });
    } catch (error) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao enviar email de verificação' });
    }
  }

  async sendPasswordReset() {
    if (this.email()) {
      try {
        await this.auth.resetPassword(this.email());
        this.messageService.add({ severity: 'success', summary: 'Enviado', detail: 'Email de redefinição de senha enviado' });
      } catch (error) {
        this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao enviar email de redefinição' });
      }
    }
  }

  onThemeChange() {
    const newTheme = this.selectedTheme();

    // 1. Update Service (which updates LocalStorage and behavior subject)
    if (this.preferences) {
      // Optimistically update local state if needed, but the service subscription should handle it
      this.preferenceService.updatePreferences({ theme: newTheme }).subscribe();
    } else {
        // If no preferences loaded yet, try to set it anyway (e.g. guest or initial load issue)
        // This handles cases where user changes theme before preferences fetch completes
         // But strictly speaking we should have preferences.
    }

    // The service's tap/next will trigger applyTheme, so we don't need manual DOM manipulation here anymore.
  }

  onTierChange(event: any) {
    if (this.preferences) {
        this.preferenceService.updatePreferences({ 
            subscription_tier: event.value 
        }).subscribe(() => {
            this.messageService.add({severity: 'success', summary: 'Tier Atualizado', detail: `Agora você é ${event.value.toUpperCase()}!`});
            this.loadAiLimits();
        });
    }
  }

  onLanguageChange(event: any) {
    if (this.preferences) {
      this.preferences.language = event.value;
      this.preferenceService.updatePreferences({ language: event.value }).subscribe();
    }
  }

  onNotificationChange(event: any) {
    if (this.preferences) {
      this.preferenceService.updatePreferences({ notifications_enabled: this.preferences.notifications_enabled }).subscribe();
    }
  }

  onUpload(event: any) {
    const file = event.files[0];
    if (file) {
      this.preferenceService.uploadAvatar(file).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Avatar atualizado!' });
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao enviar avatar.' });
        }
      });
    }
  }

  logout() {
    this.auth.logout().then(() => {
      this.router.navigate(['/login']);
    });
  }

  confirmDelete() {
    this.confirmationService.confirm({
      message: 'Tem certeza que deseja excluir sua conta permanentemente? Esta ação não pode ser desfeita.',
      header: 'Confirmar Exclusão',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Excluir Conta',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text p-button-secondary',
      accept: async () => {
        try {
          await this.auth.deleteAccount();
          this.messageService.add({ severity: 'success', summary: 'Confirmado', detail: 'Conta excluída' });
          this.router.navigate(['/login']);
        } catch (error) {
          this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao excluir conta' });
        }
      }
    });
  }

  onResetAccount() {
    this.confirmationService.confirm({
      message: 'Tem certeza que deseja LIMPAR todos os dados da sua conta? Isso excluirá todas as transações, orçamentos e categorias personalizadas.',
      header: 'Confirmar Limpeza',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Limpar Tudo',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text p-button-secondary',
      accept: () => {
        this.preferenceService.resetAccount().subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Dados da conta limpos com sucesso' });
            // Optional: Reload or redirect
            window.location.reload();
          },
          error: () => {
            this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao limpar dados da conta' });
          }
        });
      }
    });
  }

  installApp() {
    this.pwaService.installApp();
  }

  toggleWakeLock() {
    this.wakeLockEnabled.set(!this.wakeLockEnabled());
    if (this.wakeLockEnabled()) {
      this.pwaService.requestWakeLock();
      this.messageService.add({ severity: 'info', summary: 'Tela ativa', detail: 'O modo "Manter tela ligada" foi ativado.' });
    } else {
      this.pwaService.releaseWakeLock();
    }
  }
}
