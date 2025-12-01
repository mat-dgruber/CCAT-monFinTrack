import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

import { TransactionService } from '../../services/transaction.service';
import { Transaction } from '../../models/transaction.model';

@Component({
  selector: 'app-financial-calendar',
  standalone: true,
  imports: [CommonModule, ButtonModule, TooltipModule],
  templateUrl: './financial-calendar.component.html',
  styleUrl: './financial-calendar.component.scss'
})
export class FinancialCalendarComponent implements OnInit {
  private transactionService = inject(TransactionService);

  currentDate = signal(new Date());
  transactions = signal<Transaction[]>([]);
  
  // Computed values for calendar rendering
  daysInMonth = computed(() => {
    const date = this.currentDate();
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday
    
    const result = [];
    // Empty slots for previous month
    for (let i = 0; i < firstDayIndex; i++) {
        result.push(null);
    }
    // Days of current month
    for (let i = 1; i <= days; i++) {
        result.push(new Date(year, month, i));
    }
    return result;
  });

  monthLabel = computed(() => {
      return this.currentDate().toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
  });

  constructor() {}

  ngOnInit() {
    this.loadTransactions();
  }

  loadTransactions() {
    const date = this.currentDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    
    this.transactionService.getTransactions(month, year).subscribe(data => {
        this.transactions.set(data);
    });
  }

  prevMonth() {
      const date = this.currentDate();
      this.currentDate.set(new Date(date.getFullYear(), date.getMonth() - 1, 1));
      this.loadTransactions();
  }

  nextMonth() {
      const date = this.currentDate();
      this.currentDate.set(new Date(date.getFullYear(), date.getMonth() + 1, 1));
      this.loadTransactions();
  }

  getTransactionsForDay(date: Date | null): Transaction[] {
      if (!date) return [];
      return this.transactions().filter(t => {
          const tDate = new Date(t.date);
          return tDate.getDate() === date.getDate() && 
                 tDate.getMonth() === date.getMonth() && 
                 tDate.getFullYear() === date.getFullYear();
      });
  }

  getDayTotal(date: Date | null, type: 'income' | 'expense'): number {
      const txs = this.getTransactionsForDay(date);
      return txs
        .filter(t => t.type === type)
        .reduce((acc, t) => acc + t.amount, 0);
  }
}
