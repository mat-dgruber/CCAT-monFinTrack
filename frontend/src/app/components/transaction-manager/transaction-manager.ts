import { Component, OnInit, inject, signal, computed, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// PrimeNG
import { TableModule, Table } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DrawerModule } from 'primeng/drawer';
import { TooltipModule } from 'primeng/tooltip';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { SkeletonModule } from 'primeng/skeleton';

// Services
import { TransactionService } from '../../services/transaction.service';
import { CategoryService } from '../../services/category.service';
import { AccountService } from '../../services/account.service';

// Models
import { Transaction } from '../../models/transaction.model';
import { Category } from '../../models/category.model';
import { Account } from '../../models/account.model';

// Components & Pipes
import { TransactionForm } from '../transaction-form/transaction-form';
import { PaymentFormatPipe } from '../../pipes/payment-format.pipe';

@Component({
  selector: 'app-transaction-manager',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    DatePickerModule,
    CardModule,
    TagModule,
    DrawerModule,
    TooltipModule,
    TransactionForm,
    PaymentFormatPipe,
    IconFieldModule,
    InputIconModule,
    SkeletonModule
  ],
  templateUrl: './transaction-manager.html',
  styleUrl: './transaction-manager.scss'
})
export class TransactionManager implements OnInit {
  @ViewChild(TransactionForm) transactionForm!: TransactionForm;

  private transactionService = inject(TransactionService);
  private categoryService = inject(CategoryService);
  private accountService = inject(AccountService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  // Data
  transactions = signal<Transaction[]>([]);
  categories = signal<Category[]>([]);
  accounts = signal<Account[]>([]);

  // Filters
  filterDateRange = signal<Date[] | null>(null);

  // View State for Stats
  currentViewTransactions = signal<Transaction[]>([]);

  paymentMethods = [
    { label: 'Cartão de Crédito', value: 'credit_card' },
    { label: 'Débito', value: 'debit_card' },
    { label: 'Pix', value: 'pix' },
    { label: 'Dinheiro', value: 'cash' },
    { label: 'Transferência', value: 'bank_transfer' },
    { label: 'Outros', value: 'other' }
  ];

  // UI State
  loading = signal(false);
  selectedDatePreset = signal<string | null>(null);

  datePresets = [
    { label: 'Todos', value: 'all' },
    { label: 'Esse Mês', value: 'this-month' },
    { label: 'Mês Passado', value: 'last-month' },
    { label: 'Essa Semana', value: 'this-week' },
    { label: 'Esse Ano', value: 'this-year' },
    { label: 'Personalizado', value: 'custom' }
  ];

  ngOnInit() {
    this.loadData();

    // Load metadata
    this.categoryService.getCategories().subscribe(cats => this.categories.set(cats));
    this.accountService.getAccounts().subscribe(accs => this.accounts.set(accs));
  }

  loadData() {
    this.loading.set(true);
    // Fetch all transactions by default
    this.transactionService.getTransactions().subscribe({
      next: (data: Transaction[]) => {
        this.processTransactions(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar transações' });
      }
    });
  }

  onDateRangeChange() {
    const range = this.filterDateRange();
    if (range && range[0] && range[1]) {
      this.loading.set(true);
      const start = range[0].toISOString();
      const end = range[1].toISOString();

      this.transactionService.getTransactions(undefined, undefined, undefined, start, end).subscribe({
        next: (data: Transaction[]) => {
          this.processTransactions(data);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar transações' });
        }
      });
    } else {
      this.loadData();
    }
  }

  onPresetChange() {
    const preset = this.selectedDatePreset();
    const now = new Date();
    let start: Date | undefined;
    let end: Date | undefined;

    switch (preset) {
      case 'this-month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'last-month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'this-week':
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        start = new Date(now.setDate(diff));
        end = new Date(now.setDate(start.getDate() + 6));
        break;
      case 'this-year':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        break;
      case 'all':
        this.filterDateRange.set(null);
        this.loadData();
        return;
      case 'custom':
        // Do nothing, wait for date picker
        return;
    }

    if (start && end) {
      this.filterDateRange.set([start, end]);
      this.onDateRangeChange();
    }
  }

  // Computed Stats
  stats = computed(() => {
    const list = this.currentViewTransactions();
    if (list.length === 0) return null;

    const totalTransactions = list.length;
    let totalIncome = 0;
    let totalExpense = 0;
    let maxTx = 0;
    let maxExpense = 0;
    let minDate = new Date();
    let maxDate = new Date(0);

    for (const t of list) {
      const amount = t.amount;
      if (t.type === 'income') totalIncome += amount;
      else totalExpense += amount;

      if (amount > maxTx) maxTx = amount;
      if (t.type === 'expense' && amount > maxExpense) maxExpense = amount;

      const d = new Date(t.date);
      if (d < minDate) minDate = d;
      if (d > maxDate) maxDate = d;
    }

    const net = totalIncome - totalExpense;
    const avg = list.length > 0 ? (totalIncome + totalExpense) / list.length : 0;

    return {
      totalTransactions,
      totalIncome,
      totalExpense,
      net,
      maxTx,
      maxExpense,
      avgTx: avg,
      firstDate: minDate,
      lastDate: maxDate
    };
  });

  // Sorting & Grouping
  // Sorting & Grouping
  currentSortField = signal<string>('dateGroup');
  currentSortOrder = signal<number>(-1);
  currentGroupField = signal<string | null>('dateGroup');

  clear(table: Table) {
    table.clear();
    this.filterDateRange.set(null);
    this.selectedDatePreset.set('all');
    this.currentSortField.set('dateGroup');
    this.currentSortOrder.set(-1);
    this.currentGroupField.set('dateGroup');
    this.loadData();
  }

  onFilter(event: any) {
    const filtered = event.filteredValue;
    this.recalculateGroupingFlags(filtered);
    this.currentViewTransactions.set(filtered);
  }

  onSort(event: any) {
    const field = event.field;
    const order = event.order;

    this.currentSortField.set(field);
    this.currentSortOrder.set(order);

    // Only group rows if sorting by date
    if (field === 'date' || field === 'dateGroup') {
      this.currentGroupField.set('dateGroup');
    } else {
      this.currentGroupField.set(null);
    }

    if (event.data) {
      this.recalculateGroupingFlags(event.data);
    }
  }

  private processTransactions(data: Transaction[]) {
    // 1. Sort by Date Descending (Default)
    const sorted = [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    this.recalculateGroupingFlags(sorted);
    this.transactions.set(sorted);
    this.currentViewTransactions.set(sorted);
  }

  private recalculateGroupingFlags(list: Transaction[]) {
    let lastYear = -1;
    let lastMonth = -1;

    // We must mutate the objects in the list to update flags based on the current list order.
    // Since objects are references, this updates the data source too, which is fine for view flags.
    list.forEach(t => {
      const d = new Date(t.date);
      const year = d.getFullYear();
      const month = d.getMonth();

      // Ensure dateGroup is set (it should be, but just in case)
      if (!t.dateGroup) {
        t.dateGroup = d.toISOString().split('T')[0];
      }

      const isNewYear = year !== lastYear;
      const isNewMonth = month !== lastMonth || isNewYear;

      if (isNewYear) lastYear = year;
      if (isNewMonth) lastMonth = month;

      t.isNewYear = isNewYear;
      t.isNewMonth = isNewMonth;
      t.yearLabel = isNewYear ? year.toString() : undefined;
      t.monthLabel = isNewMonth ? this.getMonthName(month) : undefined;
    });
  }

  private getMonthName(monthIndex: number): string {
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return months[monthIndex];
  }

  openNew() {
    this.transactionForm.showDialog();
  }

  editTransaction(t: Transaction) {
    // We use a mock event because editTransaction expects an Event to stop propagation
    const mockEvent = { stopPropagation: () => { } } as any;
    this.transactionForm.editTransaction(mockEvent, t);
  }

  toggleStatus(event: Event, t: Transaction) {
    event.stopPropagation();
    const newStatus = t.status === 'paid' ? 'pending' : 'paid';
    const updatedData = { ...t, status: newStatus };

    // We need to send the full object or what the backend expects.
    // The backend update_transaction expects TransactionCreate schema.
    // We should ensure we are sending compatible data.
    // However, frontend models might have extra fields (like category object instead of id).
    // Let's rely on the service to handle or send what we have.
    // Usually we should send IDs.

    const payload: any = { ...t };
    if (t.category) payload.category_id = t.category.id;
    if (t.account) payload.account_id = t.account.id;
    payload.status = newStatus;

    // Remove objects to avoid circular or validation issues if backend is strict
    delete payload.category;
    delete payload.account;
    delete payload.dateGroup;
    delete payload.isNewYear;
    delete payload.isNewMonth;
    delete payload.yearLabel;
    delete payload.monthLabel;

    this.transactionService.updateTransaction(t.id, payload).subscribe({
      next: (updated) => {
        this.messageService.add({
          severity: 'success',
          summary: 'Status Atualizado',
          detail: `Transação marcada como ${newStatus === 'paid' ? 'Paga' : 'Pendente'}`
        });

        // Update local state
        this.transactions.update(list => list.map(item => item.id === t.id ? { ...item, status: newStatus } : item));
        this.currentViewTransactions.update(list => list.map(item => item.id === t.id ? { ...item, status: newStatus } : item));
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao atualizar status' })
    });
  }

  deleteTransaction(event: Event, t: Transaction) {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: 'Apagar esta transação?',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.transactionService.deleteTransaction(t.id).subscribe(() => {
          this.messageService.add({ severity: 'success', summary: 'Excluído' });
          // Reload
          this.onDateRangeChange(); // or loadData()
          // If we are in initial state (no date range), we might need to reload current month
          if (!this.filterDateRange()) {
            const now = new Date();
            this.transactionService.getTransactions(now.getMonth() + 1, now.getFullYear()).subscribe(d => {
              this.transactions.set(d);
              this.currentViewTransactions.set(d);
            });
          }
        });
      }
    });
  }

  exportCSV() {
    // Implement CSV export logic here
    // Simple client side CSV
    const data = this.currentViewTransactions();
    const csvContent = "data:text/csv;charset=utf-8,"
      + "Data,Descrição,Categoria,Valor,Tipo\n"
      + data.map((e: Transaction) => `${e.date},${e.description},${e.category?.name},${e.amount},${e.type}`).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "transacoes.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
