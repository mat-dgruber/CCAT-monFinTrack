import { Component, OnInit, inject, signal, computed, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// PrimeNG
import { TableModule } from 'primeng/table';
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
    InputIconModule
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
  filterDescription = signal('');
  filterCategory = signal<Category | null>(null);
  filterAccount = signal<Account | null>(null);
  filterDateRange = signal<Date[] | null>(null);
  filterPaymentMethod = signal<string | null>(null);

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

  // Computed Filtered Transactions
  filteredTransactions = computed(() => {
    let list = this.transactions();
    const desc = this.filterDescription().toLowerCase();
    const cat = this.filterCategory();
    const acc = this.filterAccount();
    // Date filtering is handled by the backend/onDateRangeChange mostly.
    // We skip client-side date filtering to avoid timezone mismatches with the fetched data.
    
    const pm = this.filterPaymentMethod();

    return list.filter(t => {
      // Description
      if (desc && !t.description.toLowerCase().includes(desc)) return false;

      // Category
      if (cat) {
        const transactionCatId = t.category_id || t.category?.id;
        if (transactionCatId !== cat.id) return false;
      }

      // Account
      if (acc) {
        const transactionAccId = t.account_id || t.account?.id;
        if (transactionAccId !== acc.id) return false;
      }

      // Payment Method
      if (pm && t.payment_method !== pm) return false;

      return true;
    });
  });

  // Computed Stats
  stats = computed(() => {
    const list = this.filteredTransactions();
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
    const avg = list.length > 0 ? (totalIncome + totalExpense) / list.length : 0; // Avg volume? Or avg amount? Usually avg amount regardless of sign.

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

  clearFilters() {
    this.filterDescription.set('');
    this.filterCategory.set(null);
    this.filterAccount.set(null);
    this.filterPaymentMethod.set(null);
    this.filterDateRange.set(null);
    this.loadData();
  }

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading.set(true);
    // Load dependencies
    this.categoryService.getCategories().subscribe(c => this.categories.set(c));
    this.accountService.getAccounts().subscribe(a => this.accounts.set(a));

    // Load Transactions - Initially maybe current month or all?
    // User wants "History", let's try to load a broad range or default to current month.
    // For now, let's load current month + previous month? Or just default to current.
    // Ideally we want to load EVERYTHING if we want "Advanced History" client side, or rely on server.
    // Let's try loading with no filters -> implies "all" if backend supports it.
    // If backend requires month/year, we default to now.

    const now = new Date();
    // this.transactionService.getTransactions(now.getMonth() + 1, now.getFullYear()).subscribe({
    // But we modified service to take startDate/endDate.
    // Let's try to fetch a large range or just everything.

    // If I pass nothing, what does backend do?
    // Assuming backend defaults to current month if params missing.
    // To be safe, let's fetch current year?
    // Let's just fetch current month for now to be safe, and let user change range.

    this.transactionService.getTransactions(now.getMonth() + 1, now.getFullYear()).subscribe({
        next: (data) => {
            this.transactions.set(data);
            this.loading.set(false);
        },
        error: () => this.loading.set(false)
    });
  }

  // Method to reload when filters change (if we implement server-side filtering later)
  // For now, client side filtering on the loaded set.
  // But if user picks a date range outside current month, we need to refetch.

  onDateRangeChange() {
      const dates = this.filterDateRange();
      if (dates && dates[0]) {
          const start = dates[0].toISOString().split('T')[0];
          const end = dates[1] ? dates[1].toISOString().split('T')[0] : start;

          this.loading.set(true);
          // Pass undefined for month/year to avoid conflict if backend prioritizes them
          this.transactionService.getTransactions(undefined, undefined, undefined, start, end).subscribe({
              next: (data) => {
                  this.transactions.set(data);
                  this.loading.set(false);
              },
              error: () => this.loading.set(false)
          });
      }
  }

  openNew() {
    this.transactionForm.showDialog();
  }

  editTransaction(t: Transaction) {
      // We use a mock event because editTransaction expects an Event to stop propagation
      const mockEvent = { stopPropagation: () => {} } as any;
      this.transactionForm.editTransaction(mockEvent, t);
  }

  deleteTransaction(event: Event, t: Transaction) {
    this.confirmationService.confirm({
        target: event.target as EventTarget,
        message: 'Apagar esta transação?',
        icon: 'pi pi-exclamation-triangle',
        accept: () => {
            this.transactionService.deleteTransaction(t.id).subscribe(() => {
                this.messageService.add({severity:'success', summary:'Excluído'});
                // Reload
                this.onDateRangeChange(); // or loadData()
                // If we are in initial state (no date range), we might need to reload current month
                if (!this.filterDateRange()) {
                    const now = new Date();
                    this.transactionService.getTransactions(now.getMonth() + 1, now.getFullYear()).subscribe(d => this.transactions.set(d));
                }
            });
        }
    });
  }

  exportCSV() {
      // Implement CSV export logic here
      // Simple client side CSV
      const data = this.filteredTransactions();
      const csvContent = "data:text/csv;charset=utf-8,"
          + "Data,Descrição,Categoria,Valor,Tipo\n"
          + data.map(e => `${e.date},${e.description},${e.category?.name},${e.amount},${e.type}`).join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "transacoes.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  }
}
