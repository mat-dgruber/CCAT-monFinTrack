import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';

// PrimeNG Tabs (Novo v18+)
import { TabsModule } from 'primeng/tabs';

import { TransactionList } from './components/transaction-list/transaction-list';
import { AccountManager } from './components/account-manager/account-manager';
import { Dashboard } from './components/dashboard/dashboard';
import { CategoryManager } from './components/category-manager/category-manager'; // Já vamos criar esse

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, 
    RouterOutlet, 
    TabsModule, // <--- O Módulo correto 
    TransactionList, 
    AccountManager, 
    Dashboard,
    CategoryManager
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  
}