import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

// PrimeNG Tabs (Novo v18+)
import { TabsModule } from 'primeng/tabs';

// Componentes do Sistema
import { Dashboard } from './components/dashboard/dashboard';
import { TransactionList } from './components/transaction-list/transaction-list';
import { AccountManager } from './components/account-manager/account-manager';
import { CategoryManager } from './components/category-manager/category-manager';
import { BudgetManager } from './components/budget-manager/budget-manager';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    TabsModule,       // Módulo de Abas
    Dashboard,        // Dashboard (Fixo no topo)
    TransactionList,  // Aba 1
    AccountManager,   // Aba 2
    CategoryManager,  // Aba 3
    BudgetManager     // Aba 4
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  // Lógica simples, o template html faz o trabalho pesado das abas
}