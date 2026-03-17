import { CustomConfirmService } from '../../services/custom-confirm.service';
import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ViewChild,
  AfterViewInit,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

// PrimeNG
import { TableModule, Table } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { MessageService, FilterMatchMode } from 'primeng/api';
import { DrawerModule } from 'primeng/drawer';
import { TooltipModule } from 'primeng/tooltip';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { SkeletonModule } from 'primeng/skeleton';

import { InputNumberModule } from 'primeng/inputnumber';

// Services
import { TransactionService } from '../../services/transaction.service';
import { CategoryService } from '../../services/category.service';
import { AccountService } from '../../services/account.service';
import { UserPreferenceService } from '../../services/user-preference.service';
import { FirebaseWrapperService } from '../../services/firebase-wrapper.service';
import { HttpClient } from '@angular/common/http';

// Models
import { Transaction } from '../../models/transaction.model';
import { Category } from '../../models/category.model';
import { Account } from '../../models/account.model';
import { environment } from '../../../environments/environment';
import { ImportTransactionsComponent } from '../import-transactions/import-transactions.component';

// Components & Pipes
import { TransactionForm } from '../transaction-form/transaction-form';
import { PaymentFormatPipe } from '../../pipes/payment-format.pipe';
import { PageHelpComponent } from '../page-help/page-help';

@Component({
  selector: 'app-transaction-manager',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
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
    SkeletonModule,

    InputNumberModule,
    PageHelpComponent,
    CommonModule,
  ],
  templateUrl: './transaction-manager.html',
  styleUrl: './transaction-manager.scss',
})
export class TransactionManager implements OnInit, AfterViewInit {
  @ViewChild(TransactionForm) transactionForm!: TransactionForm;
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  @ViewChild('mobileSearchInput')
  mobileSearchInput!: ElementRef<HTMLInputElement>;

  private transactionService = inject(TransactionService);
  private categoryService = inject(CategoryService);
  private accountService = inject(AccountService);
  private confirmationService = inject(CustomConfirmService);
  private messageService = inject(MessageService);
  private route = inject(ActivatedRoute);
  private userPreferenceService = inject(UserPreferenceService);
  private firebaseService = inject(FirebaseWrapperService);
  private http = inject(HttpClient);

  // User Preferences
  userPreferences = signal<any>(null);
  canUpload = computed(() => {
    const tier = this.userPreferences()?.subscription_tier;
    return tier === 'pro' || tier === 'premium';
  });
  canScan = computed(() => {
    return this.userPreferences()?.subscription_tier === 'premium';
  });

  // Data
  rawTransactions = signal<Transaction[]>([]);
  categories = signal<Category[]>([]);
  accounts = signal<Account[]>([]);

  // Filters
  filterDateRange = signal<Date[] | null>(null);

  // Status Options for Filter
  statusOptions = [
    { label: 'Pago', value: 'paid' },
    { label: 'Pendente', value: 'pending' },
  ];

  titheStatusOptions = [
    { label: 'Devolvido', value: 'PAID' },
    { label: 'Pendente', value: 'PENDING' },
    { label: 'Sem Dízimo', value: 'NONE' },
  ];

  // Amount Match Mode Options (Desktop)
  amountMatchModeOptions = [
    { label: 'Igual a', value: FilterMatchMode.EQUALS },
    { label: 'Maior que', value: FilterMatchMode.GREATER_THAN },
    { label: 'Menor que', value: FilterMatchMode.LESS_THAN },
    {
      label: 'Maior ou igual a',
      value: FilterMatchMode.GREATER_THAN_OR_EQUAL_TO,
    },
    { label: 'Menor ou igual a', value: FilterMatchMode.LESS_THAN_OR_EQUAL_TO },
  ];

  // Mobile Filters
  mobileFilterVisible = signal(false);
  mobileTransactionActionsVisible = signal(false);
  selectedTransactionForActions = signal<Transaction | null>(null);

  mobileCategoryFilter = signal<Category | null>(null);
  mobileAccountFilter = signal<Account | null>(null);
  mobileTitleFilter = signal<string>('');
  mobileStatusFilter = signal<string | null>(null);
  mobileTitheStatusFilter = signal<string | null>(null);
  mobileValueFilter = signal<number | null>(null);
  mobileValueMode = signal<string>(FilterMatchMode.EQUALS); // Default to Equals

  valueModeOptions = [
    { label: 'Igual a', value: FilterMatchMode.EQUALS },
    { label: 'Maior que', value: FilterMatchMode.GREATER_THAN },
    { label: 'Menor que', value: FilterMatchMode.LESS_THAN },
    {
      label: 'Maior ou igual',
      value: FilterMatchMode.GREATER_THAN_OR_EQUAL_TO,
    },
    { label: 'Menor ou igual', value: FilterMatchMode.LESS_THAN_OR_EQUAL_TO },
  ];

  // View State for Stats
  currentViewTransactions = signal<Transaction[]>([]);

  // Type Options for Filter
  typeOptions = [
    { label: 'Despesa', value: 'expense' },
    { label: 'Receita', value: 'income' },
    { label: 'Transferência', value: 'transfer' },
  ];

  mobileTypeFilter = signal<string | null>(null);

  paymentMethods = [
    { label: 'Cartão de Crédito', value: 'credit_card' },
    { label: 'Débito', value: 'debit_card' },
    { label: 'Pix', value: 'pix' },
    { label: 'Dinheiro', value: 'cash' },
    { label: 'Transferência', value: 'bank_transfer' },
    { label: 'Outros', value: 'other' },
  ];

  // UI State
  loading = signal(false);
  selectedDatePreset = signal<string | null>(null);

  quickFilter = signal<string>('all');
  quickFilterOptions = [
    { label: 'Todos', value: 'all', icon: 'pi pi-list' },
    { label: 'Pendentes', value: 'pending', icon: 'pi pi-clock' },
    { label: 'Hoje', value: 'today', icon: 'pi pi-calendar' },
    { label: 'Receitas', value: 'income', icon: 'pi pi-arrow-down' },
    { label: 'Despesas', value: 'expense', icon: 'pi pi-arrow-up' },
  ];

  datePresets = [
    { label: 'Todos', value: 'all' },
    { label: 'Esse Mês', value: 'this-month' },
    { label: 'Mês Passado', value: 'last-month' },
    { label: 'Essa Semana', value: 'this-week' },
    { label: 'Esse Ano', value: 'this-year' },
    { label: 'Personalizado', value: 'custom' },
  ];

  ngOnInit() {
    this.loadData();

    // Load metadata
    this.categoryService
      .getCategories()
      .subscribe((cats) => this.categories.set(cats));
    this.accountService
      .getAccounts()
      .subscribe((accs) => this.accounts.set(accs));
    this.userPreferenceService.preferences$.subscribe((prefs) =>
      this.userPreferences.set(prefs),
    );
  }

  ngAfterViewInit() {
    this.route.queryParams.subscribe((params) => {
      // Check for App Shortcut action ('new') or Protocol Parameter ('type')
      if (params['action'] === 'new' || params['type']) {
        setTimeout(() => {
          this.openNew();
          if (params['type']) {
            // Pre-select type (expense/income)
            this.transactionForm.form.patchValue({ type: params['type'] });
          }
        }, 200);
      }
    });
  }

  loadData() {
    this.loading.set(true);
    // Fetch all transactions by default
    this.transactionService.getTransactions().subscribe({
      next: (data: Transaction[]) => {
        this.rawTransactions.set(data);
        this.currentViewTransactions.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: 'Falha ao carregar transações',
        });
      },
    });
  }

  onDateRangeChange() {
    const range = this.filterDateRange();
    if (range && range[0] && range[1]) {
      this.loading.set(true);
      const start = range[0].toISOString();
      const end = range[1].toISOString();

      this.transactionService
        .getTransactions(undefined, undefined, undefined, start, end)
        .subscribe({
          next: (data: Transaction[]) => {
            this.rawTransactions.set(data);
            this.currentViewTransactions.set(data);
            this.loading.set(false);
          },
          error: () => {
            this.loading.set(false);
            this.messageService.add({
              severity: 'error',
              summary: 'Erro',
              detail: 'Falha ao carregar transações',
            });
          },
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
      else if (t.type === 'expense') totalExpense += amount;

      if (amount > maxTx) maxTx = amount;
      if (t.type === 'expense' && amount > maxExpense) maxExpense = amount;

      const d = new Date(t.date);
      if (d < minDate) minDate = d;
      if (d > maxDate) maxDate = d;
    }

    const net = totalIncome - totalExpense;
    const avg =
      list.length > 0 ? (totalIncome + totalExpense) / list.length : 0;

    // Health Ratio & Color
    const healthRatio = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0;
    let healthColor = 'primary';
    if (healthRatio > 100) healthColor = 'red-500';
    else if (healthRatio > 70) healthColor = 'orange-500';

    // Simple Trend (mocking daily data from last 7 days for sparkline)
    // In a real app, this would be grouped by day in the loop
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);
    const dailyData = list
      .filter((t) => new Date(t.date) >= last7Days)
      .reduce((acc: any, t) => {
        const d = new Date(t.date).toISOString().split('T')[0];
        if (!acc[d]) acc[d] = { income: 0, expense: 0 };
        if (t.type === 'income') acc[d].income += t.amount;
        if (t.type === 'expense') acc[d].expense += t.amount;
        return acc;
      }, {});

    const trendPoints = Object.values(dailyData).map((d: any) => ({
      income: d.income,
      expense: d.expense,
    }));

    return {
      totalTransactions,
      totalIncome,
      totalExpense,
      net,
      maxTx,
      maxExpense,
      avgTx: avg,
      firstDate: minDate,
      lastDate: maxDate,
      healthRatio,
      healthColor,
      trendPoints,
    };
  });

  // Sorting & Grouping
  // Sorting & Grouping
  currentSortField = signal<string>('dateGroup');
  currentSortOrder = signal<number>(-1);
  currentGroupField = signal<string | null>('dateGroup');

  clear(table: Table) {
    table.reset();
    // Clear search inputs visually
    if (this.searchInput) this.searchInput.nativeElement.value = '';
    if (this.mobileSearchInput) this.mobileSearchInput.nativeElement.value = '';
    this.filterDateRange.set(null);
    this.selectedDatePreset.set('all');
    this.currentSortField.set('dateGroup');
    this.currentSortOrder.set(-1);
    this.currentGroupField.set('dateGroup');
    this.clearMobileFilters();
    this.loadData();
  }

  applyMobileFilters() {
    let filtered = this.rawTransactions();

    // 1. Apply Category Filter
    const cat = this.mobileCategoryFilter();
    if (cat) {
      filtered = filtered.filter((t) => t.category?.name === cat.name);
    }

    // 2. Apply Account Filter
    const acc = this.mobileAccountFilter();
    if (acc) {
      filtered = filtered.filter((t) => t.account?.name === acc.name);
    }

    // 2.5 Apply Type Filter
    const type = this.mobileTypeFilter();
    if (type) {
      filtered = filtered.filter((t) => t.type === type);
    }

    // 3. Apply Title/Description Filter
    const title = this.mobileTitleFilter();
    if (title) {
      const term = title.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(term) ||
          (t.description && t.description.toLowerCase().includes(term)),
      );
    }

    // 4. Apply Status Filter
    const status = this.mobileStatusFilter();
    if (status) {
      filtered = filtered.filter((t) => t.status === status);
    }

    // 5. Apply Tithe Status Filter
    const titheStatus = this.mobileTitheStatusFilter();
    if (titheStatus) {
      filtered = filtered.filter((t) => t.tithe_status === titheStatus);
    }

    // 5. Apply Value Filter
    const val = this.mobileValueFilter();
    const mode = this.mobileValueMode();
    if (val !== null) {
      filtered = filtered.filter((t) => {
        switch (mode) {
          case FilterMatchMode.EQUALS:
            return t.amount === val;
          case FilterMatchMode.GREATER_THAN:
            return t.amount > val;
          case FilterMatchMode.LESS_THAN:
            return t.amount < val;
          case FilterMatchMode.GREATER_THAN_OR_EQUAL_TO:
            return t.amount >= val;
          case FilterMatchMode.LESS_THAN_OR_EQUAL_TO:
            return t.amount <= val;
          default:
            return t.amount === val;
        }
      });
    }

    // 6. Update View
    setTimeout(() => {
      this.currentViewTransactions.set(filtered);
    });
    this.mobileFilterVisible.set(false);
  }

  clearMobileFilters() {
    this.mobileCategoryFilter.set(null);
    this.mobileAccountFilter.set(null);
    this.mobileTypeFilter.set(null);
    this.mobileTitleFilter.set('');
    this.mobileStatusFilter.set(null);
    this.mobileTitheStatusFilter.set(null);
    this.mobileValueFilter.set(null);
    this.mobileValueMode.set(FilterMatchMode.EQUALS);

    this.selectedDatePreset.set('all');
    this.filterDateRange.set(null);

    // Reset to full list
    this.loadData();
    this.mobileFilterVisible.set(false);
  }

  onFilter(event: any) {
    // Use setTimeout to ensure the update happens outside the current change detection cycle
    // This is a common pattern to avoid NG0103 when one part of the view updates state that affects another part
    setTimeout(() => {
      this.currentViewTransactions.set(event.filteredValue);
    });
  }

  onSort(event: any) {
    setTimeout(() => {
      this.currentSortField.set(event.field);
      this.currentSortOrder.set(event.order);

      // Only group rows if sorting by date fields
      if (event.field === 'date' || event.field === 'dateGroup') {
        this.currentGroupField.set('dateGroup');
      } else {
        this.currentGroupField.set(null);
      }
    });
  }

  transactions = computed(() => {
    let data = this.rawTransactions();
    const filter = this.quickFilter();

    if (filter !== 'all') {
      if (filter === 'pending') {
        data = data.filter((t) => t.status === 'pending');
      } else if (filter === 'income' || filter === 'expense') {
        data = data.filter((t) => t.type === filter);
      } else if (filter === 'today') {
        const today = new Date().toISOString().split('T')[0];
        data = data.filter((t) => {
          const d = new Date(t.date).toISOString().split('T')[0];
          return d === today;
        });
      }
    }

    const field = this.currentSortField() as keyof Transaction;
    const order = this.currentSortOrder();

    const sorted = [...data].sort((a, b) => {
      let valA: any = (a as any)[field];
      let valB: any = (b as any)[field];

      if (field === 'date' || field === 'dateGroup') {
        valA = new Date(a.date).getTime();
        valB = new Date(b.date).getTime();
      }

      if (valA < valB) return -1 * order;
      if (valA > valB) return order;
      return 0;
    });

    // Pure mapping to add grouping flags
    let lastYear = -1;
    let lastMonth = -1;

    return sorted.map((t) => {
      const d = new Date(t.date);
      const year = d.getFullYear();
      const month = d.getMonth();

      const isNewYear = year !== lastYear;
      const isNewMonth = month !== lastMonth || isNewYear;

      if (isNewYear) lastYear = year;
      if (isNewMonth) lastMonth = month;

      return {
        ...t,
        dateGroup:
          t.dateGroup ||
          (isNaN(d.getTime()) ? 'Invalid Date' : d.toISOString().split('T')[0]),
        isNewYear,
        isNewMonth,
        yearLabel: isNewYear ? year.toString() : undefined,
        monthLabel: isNewMonth ? this.getMonthName(month) : undefined,
      };
    });
  });

  private getMonthName(monthIndex: number): string {
    const months = [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ];
    return months[monthIndex];
  }

  openTransactionActions(t: Transaction) {
    this.selectedTransactionForActions.set(t);
    this.mobileTransactionActionsVisible.set(true);
  }

  openNew() {
    this.transactionForm.showDialog();
  }

  editTransaction(t: Transaction) {
    // We use a mock event because editTransaction expects an Event to stop propagation
    const mockEvent = { stopPropagation: () => {} } as any;
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

    // Clean up payload
    delete payload.id;
    delete payload._id;
    delete payload.category;
    delete payload.account;

    // UI Flags
    delete payload.dateGroup;
    delete payload.isNewYear;
    delete payload.isNewMonth;
    delete payload.yearLabel;
    delete payload.monthLabel;

    // Ensure dates are strings or Date objects (Angular handles Dates, but strings are safer)
    if (payload.date instanceof Date) payload.date = payload.date.toISOString();
    if (payload.payment_date instanceof Date)
      payload.payment_date = payload.payment_date.toISOString();

    this.transactionService.updateTransaction(t.id, payload).subscribe({
      next: (updated) => {
        this.messageService.add({
          severity: 'success',
          summary: 'Status Atualizado',
          detail: `Transação marcada como ${newStatus === 'paid' ? 'Paga' : 'Pendente'}`,
        });

        // Update local state
        this.rawTransactions.update((list) =>
          list.map((item) =>
            item.id === t.id ? { ...item, status: newStatus } : item,
          ),
        );
        this.currentViewTransactions.update((list) =>
          list.map((item) =>
            item.id === t.id ? { ...item, status: newStatus } : item,
          ),
        );
      },
      error: () =>
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: 'Falha ao atualizar status',
        }),
    });
  }

  deleteTransaction(event: Event, t: Transaction) {
    this.confirmationService.confirm({
      message: `Tem certeza que deseja excluir a transação '${t.title}' de ${t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}?`,
      header: 'Confirmar Exclusão',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Excluir',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text p-button-secondary',
      accept: () => {
        this.transactionService.deleteTransaction(t.id).subscribe(() => {
          this.messageService.add({ severity: 'success', summary: 'Excluído' });
          // Reload
          this.onDateRangeChange(); // or loadData()
          // If we are in initial state (no date range), we might need to reload current month
          if (!this.filterDateRange()) {
            const now = new Date();
            this.transactionService
              .getTransactions(now.getMonth() + 1, now.getFullYear())
              .subscribe((d: Transaction[]) => {
                this.rawTransactions.set(d);
              });
          } else {
            this.onDateRangeChange();
          }
        });
      },
    });
  }

  async exportCSV() {
    const data = this.currentViewTransactions();
    // Add BOM for Excel compatibility
    const bom = '\uFEFF';
    const csvHeader = 'Data,Título,Descrição,Categoria,Valor,Tipo\n';
    const csvRows = data
      .map((e: Transaction) => {
        // Handle potential commas in fields by wrapping in quotes
        const title = `"${e.title.replace(/"/g, '""')}"`;
        const desc = `"${(e.description || '').replace(/"/g, '""')}"`;
        const cat = `"${(e.category?.name || 'Sem Categoria').replace(/"/g, '""')}"`;
        return `${e.date},${title},${desc},${cat},${e.amount},${e.type}`;
      })
      .join('\n');

    const csvContent = bom + csvHeader + csvRows;

    // Try File System Access API
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: 'transacoes.csv',
          types: [
            {
              description: 'CSV File',
              accept: { 'text/csv': ['.csv'] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(csvContent);
        await writable.close();
        this.messageService.add({
          severity: 'success',
          summary: 'Exportado',
          detail: 'Arquivo salvo com sucesso!',
        });
        return;
      } catch (err: any) {
        // Build failed or user cancelled
        if (err.name !== 'AbortError') {
          console.error('File System Access Error:', err);
          // Fallback to legacy
        } else {
          return; // User cancelled
        }
      }
    }

    // Fallback
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'transacoes.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // --- Attachments & AI ---

  isScanning = signal(false);
  tempAttachments = signal<string[]>([]);

  async onFileUpload(event: any) {
    const file = event.files[0];
    if (!file) return;

    if (!this.canUpload()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Upgrade Necessário',
        detail: 'Recurso disponível apenas para planos Pro e Premium.',
      });
      return;
    }

    try {
      this.loading.set(true);

      // 1. Upload to Storage
      const path = `receipts/${this.userPreferences().user_id}/${Date.now()}_${file.name}`;
      const url = await this.firebaseService.uploadFile(path, file);
      this.tempAttachments.update((list) => [...list, url]);

      // Add to form
      const currentAttachments =
        this.transactionForm.form.get('attachments')?.value || [];
      this.transactionForm.form.patchValue({
        attachments: [...currentAttachments, url],
      });

      this.messageService.add({
        severity: 'success',
        summary: 'Sucesso',
        detail: 'Arquivo anexado!',
      });

      // 2. AI Scan (Premium Only)
      if (this.canScan() && file.type.startsWith('image/')) {
        this.scanReceipt(file);
      }
    } catch (e) {
      console.error(e);
      this.messageService.add({
        severity: 'error',
        summary: 'Erro',
        detail: 'Falha no upload.',
      });
    } finally {
      this.loading.set(false);
      event.originalEvent.target.value = ''; // Reset input
    }
  }

  async scanReceipt(file: File) {
    this.isScanning.set(true);
    this.messageService.add({
      severity: 'info',
      summary: 'IA',
      detail: 'Analisando comprovante...',
    });

    const formData = new FormData();
    formData.append('file', file);

    // We need to import environment to get API URL properly or use a service
    // Assuming a service method exists would be cleaner, but I'll make a direct call for now or use transactionService if avoiding new service files.
    // Ideally, create a ScannerService. For speed, I'll direct call here using injected http.
    const apiUrl = 'http://localhost:8000/api/ai/scan'; // Better to use environment

    // Using fetch or http client? I injected http.
    // Need dynamic URL from environment
    // Let's assume relative path /api/ai/scan works due to proxy or base url
    // Actually, transactionService has apiUrl.

    // Quick fix for URL:
    const url = `${environment.apiUrl}/ai/scan`;

    this.http.post<any>(url, formData).subscribe({
      next: (data) => {
        if (data) {
          // 1. Build Description from Items & Location
          let desc = '';
          if (data.location) {
            desc += `📍 Local: ${data.location}\n`;
          }

          if (data.items && data.items.length > 0) {
            desc += '\nItens:\n';
            data.items.forEach((item: any) => {
              desc += `- ${item.description}: ${item.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`;
            });
          }

          // 2. Patch Form
          this.transactionForm.form.patchValue({
            title: data.title || this.transactionForm.form.get('title')?.value,
            amount:
              data.amount || this.transactionForm.form.get('amount')?.value,
            date: data.date
              ? new Date(data.date)
              : this.transactionForm.form.get('date')?.value,
            description: desc, // Formatted description
            payment_method:
              data.payment_method ||
              this.transactionForm.form.get('payment_method')?.value,
          });

          if (data.category_id) {
            const cat = this.categories().find(
              (c) => c.id === data.category_id,
            );
            if (cat) this.transactionForm.form.patchValue({ category: cat });
          }

          if (data.account_id) {
            const acc = this.accounts().find((a) => a.id === data.account_id);
            if (acc) this.transactionForm.form.patchValue({ account: acc });
          }

          this.messageService.add({
            severity: 'success',
            summary: 'IA Concluída',
            detail: 'Itens detalhados e conta sugerida!',
          });
        }
        this.isScanning.set(false);
      },
      error: (e) => {
        console.error(e);
        this.messageService.add({
          severity: 'warn',
          summary: 'IA',
          detail: 'Não foi possível ler o comprovante.',
        });
        this.isScanning.set(false);
      },
    });
  }

  removeAttachment(url: string) {
    // Remove from form
    const current = this.transactionForm.form.get('attachments')?.value || [];
    const updated = current.filter((u: string) => u !== url);
    this.transactionForm.form.patchValue({ attachments: updated });

    // Optional: Delete from storage (could be risky if shared, but usually fine here)
    // For now, just unlink.
  }
}
