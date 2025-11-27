import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ButtonModule } from 'primeng/button';

// Componentes
import { Login } from '../login/login';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    ToastModule,
    ConfirmDialogModule,
    RouterModule,
    Login,
    ButtonModule
  ],
  templateUrl: './home.html',
})
export class Home {
  authService = inject(AuthService);

  logout() {
    this.authService.logout();
  }
}
