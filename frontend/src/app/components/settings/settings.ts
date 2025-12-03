import { Component, inject, signal, computed } from '@angular/core'; // Force rebuild
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { UserPreferenceService } from '../../services/user-preference.service';
import { UserPreference } from '../../models/user-preference.model';

// PrimeNG Imports
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { TagModule } from 'primeng/tag';
import { AvatarModule } from 'primeng/avatar';
import { FileUploadModule } from 'primeng/fileupload';
import { MessageService, ConfirmationService } from 'primeng/api';

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
    ToggleSwitchModule,
    ToastModule,
    ConfirmDialogModule,
    SelectModule,
    DatePickerModule,
    TagModule,
    AvatarModule,
    FileUploadModule,
    RouterModule
  ],
  providers: [MessageService, ConfirmationService]
})
export class Settings {
  auth = inject(AuthService);
  themeService = inject(ThemeService);
  router = inject(Router);
  messageService = inject(MessageService);
  confirmationService = inject(ConfirmationService);
  preferenceService = inject(UserPreferenceService);

  preferences: UserPreference | null = null;

  // Computed signal for profile image
  profileImageUrl = computed(() => {
    return this.preferenceService.getProfileImageUrl(this.preferences?.profile_image_url);
  });


  displayName = signal('');
  email = signal('');

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
  selectedTheme = signal<'light' | 'dark'>('light');
  themeOptions = [
    { label: 'Claro', value: 'light' },
    { label: 'Escuro', value: 'dark' }
  ];

  constructor() {
    // Initialize with current user data
    const user = this.auth.currentUser();
    if (user) {
      this.displayName.set(user.displayName || '');
      this.email.set(user.email || '');
    }

    // Sync local state with service
    this.selectedTheme.set(this.themeService.darkMode() ? 'dark' : 'light');

    this.preferenceService.preferences$.subscribe(prefs => {
      this.preferences = prefs;
      if (prefs) {
        this.selectedTheme.set(prefs.theme);
        if (prefs.birthday) this.birthday.set(new Date(prefs.birthday));
        if (prefs.timezone) this.selectedTimezone.set(prefs.timezone);
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

    // Update Service
    if (this.preferences) {
      this.preferences.theme = newTheme;
      this.preferenceService.updatePreferences({ theme: newTheme }).subscribe();
    }

    // Update Local Theme Service
    if (newTheme === 'dark') {
      if (!this.themeService.darkMode()) {
        this.themeService.toggleTheme();
      }
    } else {
      if (this.themeService.darkMode()) {
        this.themeService.toggleTheme();
      }
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
      message: 'Tem certeza que deseja excluir sua conta? Esta ação não pode ser desfeita.',
      header: 'Excluir Conta',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger p-button-text',
      rejectButtonStyleClass: 'p-button-text p-button-text',
      acceptIcon: 'none',
      rejectIcon: 'none',
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
      message: 'Tem certeza que deseja LIMPAR sua conta? Isso excluirá todas as transações, orçamentos e categorias personalizadas, mas manterá sua conta ativa. Esta ação não pode ser desfeita.',
      header: 'Limpar Dados da Conta',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-warning p-button-text',
      rejectButtonStyleClass: 'p-button-text p-button-text',
      acceptIcon: 'none',
      rejectIcon: 'none',
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
}
