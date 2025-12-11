import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';

// Componentes
// Componentes


import { AuthService } from '../../services/auth.service';
import { UserPreferenceService } from '../../services/user-preference.service';
import { PwaService } from '../../services/pwa.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    ToastModule,
    ConfirmDialogModule,
    RouterModule,
    ButtonModule,
    DrawerModule
  ],
  templateUrl: './home.html',
})
export class Home {
  authService = inject(AuthService);
  userPreferenceService = inject(UserPreferenceService);
  pwaService = inject(PwaService);

  sidebarVisible = signal(false);

  firstName = computed(() => {
    const user = this.authService.currentUser();
    return user?.displayName?.split(' ')[0] || 'Usuário';
  });

  logout() {
    this.authService.logout();
  }

  toggleSidebar() {
    this.sidebarVisible.update(v => !v);
  }

  closeSidebar() {
    this.sidebarVisible.set(false);
  }
}
