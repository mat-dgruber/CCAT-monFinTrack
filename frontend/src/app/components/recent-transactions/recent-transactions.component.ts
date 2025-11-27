import { Component, OnInit, inject, signal, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TransactionService } from '../../services/transaction.service';
import { RefreshService } from '../../services/refresh.service';
import { Transaction } from '../../models/transaction.model';
import { TransactionForm } from '../transaction-form/transaction-form';
import { PaymentFormatPipe } from '../../pipes/payment-format.pipe';
import { ConfirmationService, MessageService } from 'primeng/api';

@Component({
  selector: 'app-recent-transactions',
  standalone: true,
  imports: [CommonModule, ButtonModule, TransactionForm, PaymentFormatPipe],
  templateUrl: './recent-transactions.component.html',
  styles: []
})
export class RecentTransactionsComponent implements OnInit {
  @ViewChild(TransactionForm) transactionForm!: TransactionForm;

  private transactionService = inject(TransactionService);
  private refreshService = inject(RefreshService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  transactions = signal<Transaction[]>([]);
  groupedTransactions = signal<{ date: string; transactions: Transaction[] }[]>([]);

  constructor() {
    effect(() => {
      this.refreshService.refreshSignal();
      this.loadRecentTransactions();
    });
  }

  ngOnInit() {
    this.loadRecentTransactions();
  }

  loadRecentTransactions() {
    // Fetch last 7 transactions (no month/year filter to get global recent)
    this.transactionService.getTransactions(undefined, undefined, 7).subscribe({
      next: (data) => {
        this.transactions.set(data);
        this.groupTransactionsByDate(data);
      },
      error: (err) => console.error('Error loading recent transactions', err)
    });
  }

  groupTransactionsByDate(transactions: Transaction[]) {
    const groups: { [key: string]: Transaction[] } = {};

    transactions.forEach(t => {
      if (!t.date) return;
      // Convert Firestore timestamp or string to Date object if needed
      // Assuming t.date is handled correctly by the service/model, but let's be safe
      const dateObj = new Date(t.date);
      const dateKey = this.formatDate(dateObj);

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(t);
    });

    const result = Object.keys(groups).map(date => ({
      date,
      transactions: groups[date]
    }));

    this.groupedTransactions.set(result);
  }

  formatDate(date: Date): string {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (this.isSameDay(date, today)) {
      return 'Hoje';
    } else if (this.isSameDay(date, yesterday)) {
      return 'Ontem';
    } else {
      return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date);
    }
  }

  isSameDay(d1: Date, d2: Date): boolean {
    return d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear();
  }

  editTransaction(event: Event, transaction: Transaction) {
    event.stopPropagation();
    this.transactionForm.editTransaction(event, transaction);
  }

  openNewTransaction() {
    this.transactionForm.showDialog();
  }

  deleteTransaction(event: Event, transaction: Transaction) {
    event.stopPropagation(); // Prevent row click
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `Tem certeza que deseja excluir esta transação?`,
      header: 'Confirmar Exclusão',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sim',
      rejectLabel: 'Não',
      accept: () => {
        this.transactionService.deleteTransaction(transaction.id).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Transação excluída.' });
            this.refreshService.triggerRefresh();
          },
          error: () => {
            this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Erro ao excluir transação.' });
          }
        });
      }
    });
  }
}
