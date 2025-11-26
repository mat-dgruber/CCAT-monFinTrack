import { Component, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ButtonModule } from 'primeng/button';

// Componentes
import { Dashboard } from '../dashboard/dashboard';
import { Login } from '../login/login';
import { Sidebar } from '../shared/sidebar/sidebar';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    ToastModule,
    ConfirmDialogModule,
    Dashboard,
    RouterModule,
    Login,
    Sidebar,
    ButtonModule
  ],
  templateUrl: './home.html',
})
export class Home {
  @ViewChild(Sidebar) sidebar!: Sidebar;
  authService = inject(AuthService);

  logout() {
    this.authService.logout();
  }

  toggleSidebar() {
    this.sidebar.sidebarVisible = !this.sidebar.sidebarVisible;
  }
}
