import { Component, inject, effect } from '@angular/core'; // Adicione inject e effect
import { CommonModule } from '@angular/common';
import { TabsModule } from 'primeng/tabs';

// Componentes
import { Dashboard } from './components/dashboard/dashboard';
import { TransactionList } from './components/transaction-list/transaction-list';
import { AccountManager } from './components/account-manager/account-manager';
import { CategoryManager } from './components/category-manager/category-manager';
import { BudgetManager } from './components/budget-manager/budget-manager';
import { Login } from './components/login/login'; // <--- Importe o Login

import { AuthService } from './services/auth.service'; // <--- Importe o Auth

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    TabsModule,
    Dashboard,
    TransactionList,
    AccountManager,
    CategoryManager,
    BudgetManager,
    Login // <--- Adicione aos imports
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  authService = inject(AuthService); // Injete público para usar no HTML

  // Opcional: Botão de Logout
  logout() {
    this.authService.logout();
  }
}