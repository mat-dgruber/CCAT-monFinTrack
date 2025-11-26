import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TabsModule } from 'primeng/tabs';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ButtonModule } from 'primeng/button';

// Componentes
import { Dashboard } from '../dashboard/dashboard';
import { TransactionList } from '../transaction-list/transaction-list';
import { AccountManager } from '../account-manager/account-manager';
import { CategoryManager } from '../category-manager/category-manager';
import { BudgetManager } from '../budget-manager/budget-manager';
import { Login } from '../login/login';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    TabsModule,
    ToastModule,
    ConfirmDialogModule,
    Dashboard,
    RouterModule,
    TransactionList,
    AccountManager,
    CategoryManager,
    BudgetManager,
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
