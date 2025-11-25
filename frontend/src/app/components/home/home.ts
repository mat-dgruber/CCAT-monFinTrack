import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabsModule } from 'primeng/tabs';

// Componentes
import { Dashboard } from '../dashboard/dashboard';
import { TransactionList } from '../transaction-list/transaction-list';
import { AccountManager } from '../account-manager/account-manager';
import { CategoryManager } from '../category-manager/category-manager';
import { BudgetManager } from '../budget-manager/budget-manager';
import { Login } from '../login/login';
import { MonthSelector } from '../month-selector/month-selector';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    TabsModule,
    Dashboard,
    TransactionList,
    AccountManager,
    CategoryManager,
    BudgetManager,
    Login,
    MonthSelector
  ],
  templateUrl: './home.html',
})
export class Home {
  authService = inject(AuthService);

  logout() {
    this.authService.logout();
  }
}
