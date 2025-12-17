import { Component, OnInit, signal, inject, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';

// PrimeNG Imports
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TabsModule } from 'primeng/tabs';
import { ProgressBarModule } from 'primeng/progressbar';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { SelectButtonModule } from 'primeng/selectbutton';

import { ConfirmationService, MessageService } from 'primeng/api';

import { RecurrenceService } from '../../services/recurrence.service';
import { TransactionService } from '../../services/transaction.service';
import { Recurrence, RecurrencePeriodicity } from '../../models/recurrence.model';
import { Transaction } from '../../models/transaction.model';

import { CategoryService } from '../../services/category.service';
import { AccountService } from '../../services/account.service';
import { Category } from '../../models/category.model';
import { Account } from '../../models/account.model';
import { PeriodicityPipe } from '../../pipes/periodicity.pipe';

import { SkeletonModule } from 'primeng/skeleton';
import { AIService } from '../../services/ai.service';
import { SubscriptionService } from '../../services/subscription.service';

@Component({
  selector: 'app-subscriptions-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TableModule,
    TagModule,
    TabsModule,
    ProgressBarModule,
    ConfirmDialogModule,
    ToastModule,
    TooltipModule,
    DialogModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    CheckboxModule,
    SelectButtonModule,
    ReactiveFormsModule,
    FormsModule,
    PeriodicityPipe,
    SkeletonModule
  ],
  providers: [MessageService],
  templateUrl: './subscriptions-dashboard.component.html',
  styleUrl: './subscriptions-dashboard.component.scss'
})


// ... existing code ...

export class SubscriptionsDashboardComponent implements OnInit {
  private recurrenceService = inject(RecurrenceService);
  private transactionService = inject(TransactionService);
  private categoryService = inject(CategoryService);
  private accountService = inject(AccountService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);
  private aiService = inject(AIService); // Inject AI Service
  subscriptionService = inject(SubscriptionService);
  private fb = inject(FormBuilder);

  recurrences = signal<Recurrence[]>([]);
  transactions = signal<Transaction[]>([]);
  categories = signal<Category[]>([]);
  accounts = signal<Account[]>([]);
  suggestions = signal<any[]>([]); // New signal for suggestions
  currentDate = signal(new Date());
  loading = signal(true);

  // Dialog State
  displayDialog = false;
  dialogHeader = '';
  recurrenceForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    periodicity: [RecurrencePeriodicity.MONTHLY, Validators.required],
    due_day: [1, [Validators.required, Validators.min(1), Validators.max(31)]],
    due_month: [null],
    category_id: ['', Validators.required],
    account_id: ['', Validators.required],
    payment_method_id: [null, Validators.required],
    credit_card_id: [null],
    auto_pay: [false],
    active: [true]
  });
  isEditMode = false;
  currentRecurrenceId: string | null = null;
  selectedType: 'expense' | 'income' = 'expense';

  typeOptions = [
    { label: 'Despesa', value: 'expense' },
    { label: 'Receita', value: 'income' }
  ];

  periodicityOptions = [
    { label: 'Mensal', value: RecurrencePeriodicity.MONTHLY },
    { label: 'Anual', value: RecurrencePeriodicity.YEARLY },
    { label: 'Semanal', value: RecurrencePeriodicity.WEEKLY }
  ];

  dayOptions = Array.from({ length: 31 }, (_, i) => ({ label: `Dia ${i + 1}`, value: i + 1 }));

  monthOptions = [
    { label: 'Janeiro', value: 1 },
    { label: 'Fevereiro', value: 2 },
    { label: 'Março', value: 3 },
    { label: 'Abril', value: 4 },
    { label: 'Maio', value: 5 },
    { label: 'Junho', value: 6 },
    { label: 'Julho', value: 7 },
    { label: 'Agosto', value: 8 },
    { label: 'Setembro', value: 9 },
    { label: 'Outubro', value: 10 },
    { label: 'Novembro', value: 11 },
    { label: 'Dezembro', value: 12 }
  ];

  paymentOptions = [
    { label: 'Cartão de Crédito', value: 'credit_card' },
    { label: 'Débito', value: 'debit_card' },
    { label: 'Pix', value: 'pix' },
    { label: 'Dinheiro', value: 'cash' },
    { label: 'Boleto', value: 'bank_transfer' }
  ];

  availableCreditCards = computed(() => {
    // Collect all cards from accounts
    const cards: any[] = [];
    this.accounts().forEach(acc => {
      if (acc.credit_cards && acc.credit_cards.length > 0) {
        cards.push(...acc.credit_cards);
      }
    });
    return cards;
  });

  // Reload transactions whenever the current date changes
  transactionsEffect = effect(() => {
    this.loadTransactions();
  });

  constructor() {
    // Listen to Payment Method changes to clear CC if not applicable
    this.recurrenceForm.get('payment_method_id')?.valueChanges.subscribe(val => {
       if (val !== 'credit_card') {
           this.recurrenceForm.patchValue({ credit_card_id: null });
       }
    });
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData() {
    this.loading.set(true);
    this.loadRecurrences();
    this.loadTransactions();
    this.loadCategories();
    this.loadAccounts();
    this.loadSuggestions(); // New
  }

  loadSuggestions() {
      this.aiService.getSubscriptionSuggestions().subscribe({
          next: (data) => this.suggestions.set(data),
          error: (err) => console.log('Suggestions error', err)
      });
  }

  loadRecurrences() {
    this.recurrenceService.getRecurrences(false).subscribe({
      next: (data) => {
        this.recurrences.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  loadTransactions() {
    const date = this.currentDate();
    this.transactionService.getTransactions(date.getMonth() + 1, date.getFullYear()).subscribe(data => {
      this.transactions.set(data);
    });
  }

  loadCategories() {
    this.categoryService.getCategories().subscribe(data => {
      this.categories.set(data);
    });
  }

  loadAccounts() {
    this.accountService.getAccounts().subscribe(data => {
      this.accounts.set(data);
    });
  }

  // Filter categories based on selected type
  filteredCategories = computed(() => {
    return this.categories().filter(c => c.type === this.selectedType);
  });

  // Active Recurrences for Management Tab
  activeRecurrences = computed(() => {
    return this.recurrences().filter(r => r.active);
  });

  // Projeção de Recorrências Unificada com Transações Reais
  projectedRecurrences = computed(() => {
    // We now use ALL recurrences (active and inactive) to show history correctly
    const allRecurrences = this.recurrences();
    const date = this.currentDate();
    const month = date.getMonth();
    const year = date.getFullYear();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Start and End of the current view month
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);
    const currentTransactions = this.transactions();

    return allRecurrences.filter(r => {
      const createdAt = new Date(r.created_at);
      const cancellationDate = r.cancellation_date ? new Date(r.cancellation_date) : null;

      // 1. Must be created before or during this month
      if (createdAt > endOfMonth) return false;

      // 2. If cancelled, must be cancelled AFTER the start of this month
      // (i.e. it was still active for at least part of this month)
      if (cancellationDate && cancellationDate < startOfMonth) return false;

      // Filter out yearly recurrences that are not in the current month
      if (r.periodicity === RecurrencePeriodicity.YEARLY) {
        // If due_month is set, use it. Otherwise, fallback to creation month.
        if (r.due_month) {
          return r.due_month === month + 1; // month is 0-indexed, due_month is 1-indexed
        }

        // Fallback to creation date if due_month is not set
        return createdAt.getMonth() === month;
      }
      return true;
    }).map(r => {
      let day = r.due_day;
      if (day > daysInMonth) day = daysInMonth;

      const dueDate = new Date(year, month, day);

      // Check if there is a real transaction for this recurrence in this month
      const transaction = currentTransactions.find(t => {
        if (t.recurrence_id !== r.id) return false;
        const tDate = new Date(t.date);
        return tDate.getMonth() === month && tDate.getFullYear() === year;
      });

      if (transaction) {
        return {
          id: r.id,
          name: transaction.description, // Use transaction description
          amount: transaction.amount,
          dueDate: new Date(transaction.date),
          status: transaction.status, // 'paid' or 'pending'
          periodicity: r.periodicity,
          transactionId: transaction.id,
          originalTransaction: transaction,
          active: r.active
        };
      }

      // If cancelled before due date and not paid, don't show
      const cancellationDate = r.cancellation_date ? new Date(r.cancellation_date) : null;
      if (cancellationDate && cancellationDate < dueDate) {
        return null;
      }

      // Virtual projection
      const yearStr = dueDate.getFullYear();
      const monthStr = String(dueDate.getMonth() + 1).padStart(2, '0');
      const dayStr = String(dueDate.getDate()).padStart(2, '0');
      const dueDateString = `${yearStr}-${monthStr}-${dayStr}`;

      if (r.skipped_dates?.includes(dueDateString)) return null;

      return {
        id: r.id,
        name: r.name,
        amount: r.amount,
        dueDate: dueDate,
        status: r.auto_pay ? 'paid' : 'pending',
        periodicity: r.periodicity,
        transactionId: null,
        active: r.active
      };
    })
      .filter(item => item !== null) // Remove nulls (cancelled before due date or skipped)
      .sort((a, b) => a!.dueDate.getTime() - b!.dueDate.getTime()) as any[]; // Cast to remove null type
  });

  // Calendar Logic
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

  prevMonth() {
    const date = this.currentDate();
    this.currentDate.set(new Date(date.getFullYear(), date.getMonth() - 1, 1));
  }

  nextMonth() {
    const date = this.currentDate();
    this.currentDate.set(new Date(date.getFullYear(), date.getMonth() + 1, 1));
  }

  getRecurrencesForDay(date: Date | null): any[] {
    if (!date) return [];
    return this.projectedRecurrences().filter(r => {
      const rDate = r.dueDate;
      return rDate.getDate() === date.getDate() &&
        rDate.getMonth() === date.getMonth() &&
        rDate.getFullYear() === date.getFullYear();
    });
  }

  // Totais
  totalMonthly = computed(() => {
    return this.projectedRecurrences().reduce((acc, curr) => acc + curr.amount, 0);
  });

  totalPaid = computed(() => {
    return this.projectedRecurrences()
      .filter(r => r.status === 'paid')
      .reduce((acc, r) => acc + r.amount, 0);
  });

  totalRemaining = computed(() => {
    return this.projectedRecurrences()
      .filter(r => r.status === 'pending')
      .reduce((acc, r) => acc + r.amount, 0);
  });

  progressPercentage = computed(() => {
    const total = this.totalMonthly();
    if (total === 0) return 0;
    return (this.totalPaid() / total) * 100;
  });

  // Actions
  openSuggestionDialog(suggestion: any) {
    this.showDialog(); // Open as new (reset form, editMode=false)
    
    // Pre-fill with suggestion data
    this.recurrenceForm.patchValue({
        name: suggestion.title,
        amount: suggestion.avg_amount,
        periodicity: 'monthly', // Default from analysis
        due_day: 1
    });
  }

  showDialog(recurrence?: Recurrence) {
    this.displayDialog = true;

    if (recurrence) {
      this.isEditMode = true;
      this.dialogHeader = 'Editar Recorrência';
      this.currentRecurrenceId = recurrence.id;
      this.recurrenceForm.patchValue(recurrence);

      // Try to determine type from category if editing
      const category = this.categories().find(c => c.id === recurrence.category_id);
      if (category) {
        this.selectedType = category.type as 'expense' | 'income';
      } else {
        this.selectedType = 'expense'; // Default fallback
      }

    } else {
      this.isEditMode = false;
      this.dialogHeader = 'Nova Recorrência';
      this.currentRecurrenceId = null;
      this.selectedType = 'expense'; // Default for new
      this.recurrenceForm.reset({
        periodicity: RecurrencePeriodicity.MONTHLY,
        due_day: 1,
        active: true,
        auto_pay: false,
        payment_method_id: 'pix' // Default
      });
    }
  }

  saveRecurrence() {
    if (this.recurrenceForm.invalid) return;

    const formValue = this.recurrenceForm.value;

    if (this.isEditMode && this.currentRecurrenceId) {
      // Ask user for scope: All or Future
      this.confirmationService.confirm({
        message: 'Deseja aplicar as alterações em todos os registros ou apenas nos próximos?',
        header: 'Atualizar Recorrência',
        icon: 'pi pi-question-circle',
        acceptLabel: 'Apenas Próximos',
        rejectLabel: 'Todos',
        acceptButtonStyleClass: 'p-button-outlined p-button-info',
        rejectButtonStyleClass: 'p-button-text p-button-secondary',
        accept: () => {
          this.updateRecurrence(this.currentRecurrenceId!, formValue, 'future');
        },
        reject: () => {
          this.updateRecurrence(this.currentRecurrenceId!, formValue, 'all');
        }
      });
    } else {
      this.recurrenceService.createRecurrence(formValue).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Recorrência criada.' });
          this.displayDialog = false;
          this.loadRecurrences();
        },
        error: () => this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Erro ao criar.' })
      });
    }
  }

  updateRecurrence(id: string, data: any, scope: 'all' | 'future') {
    this.recurrenceService.updateRecurrence(id, data, scope).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Recorrência atualizada.' });
        this.displayDialog = false;
        this.loadRecurrences();
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Erro ao atualizar.' })
    });
  }

  toggleAutoPay(recurrence: Recurrence) {
    const newStatus = !recurrence.auto_pay;
    // We update 'all' scope because auto_pay is a rule for the recurrence definition
    this.recurrenceService.updateRecurrence(recurrence.id, { auto_pay: newStatus }, 'all').subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Sucesso',
          detail: `Pagamento automático ${newStatus ? 'ativado' : 'desativado'}`
        });
        this.loadRecurrences();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Erro ao atualizar status.' });
        // Revert local state if needed, but loadRecurrences will fix it
      }
    });
  }

  cancelRecurrence(recurrence: Recurrence) {
    this.confirmationService.confirm({
      message: `Tem certeza que deseja cancelar a assinatura '${recurrence.name}'?`,
      header: 'Confirmar Cancelamento',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Cancelar Assinatura',
      rejectLabel: 'Voltar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text p-button-secondary',
      accept: () => {
        this.recurrenceService.cancelRecurrence(recurrence.id).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Assinatura cancelada.' });
            this.loadRecurrences();
          },
          error: () => {
            this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Erro ao cancelar assinatura.' });
          }
        });
      }
    });
  }

  markAsPaid(item: any) {
    if (item.transactionId && item.originalTransaction) {
      const payload = {
        title: item.originalTransaction.title,
        description: item.originalTransaction.description,
        amount: item.originalTransaction.amount,
        date: item.originalTransaction.date,
        type: item.originalTransaction.type,
        payment_method: item.originalTransaction.payment_method,
        category_id: item.originalTransaction.category.id,
        account_id: item.originalTransaction.account.id,
        status: 'paid',
        recurrence_id: item.originalTransaction.recurrence_id
      };

      this.transactionService.updateTransaction(item.transactionId, payload as any).subscribe(() => {
        this.loadTransactions();
      });
    } else {
      const rec = this.recurrences().find(r => r.id === item.id);
      if (!rec) return;

      const category = this.categories().find(c => c.id === rec.category_id);
      const type = category ? category.type : 'expense';

      const newTransaction: any = {
        title: `${rec.name} (${item.dueDate.getMonth() + 1}/${item.dueDate.getFullYear()})`,
        description: `${rec.name} (${item.dueDate.getMonth() + 1}/${item.dueDate.getFullYear()})`,
        amount: rec.amount,
        date: item.dueDate,
        type: type,
        payment_method: rec.payment_method_id || 'other', // Use correct method
        credit_card_id: rec.credit_card_id || null, // Use correct card
        category_id: rec.category_id,
        account_id: rec.account_id,
        recurrence_id: rec.id,
        status: 'paid'
      };

      this.transactionService.createTransaction(newTransaction).subscribe(() => {
        this.loadTransactions();
      });
    }
  }

  markAsUnpaid(item: any) {
    if (item.transactionId && item.originalTransaction) {
      const payload = {
        title: item.originalTransaction.title,
        description: item.originalTransaction.description,
        amount: item.originalTransaction.amount,
        date: item.originalTransaction.date,
        type: item.originalTransaction.type,
        payment_method: item.originalTransaction.payment_method,
        category_id: item.originalTransaction.category.id,
        account_id: item.originalTransaction.account.id,
        status: 'pending',
        recurrence_id: item.originalTransaction.recurrence_id
      };

      this.transactionService.updateTransaction(item.transactionId, payload as any).subscribe(() => {
        this.loadTransactions();
      });
    }
  }

  getRecurrenceStatus(recurrence: Recurrence): 'paid' | 'pending' | 'n/a' {
    const item = this.projectedRecurrences().find(p => p.id === recurrence.id);
    return item ? item.status : 'n/a';
  }

  toggleRecurrenceStatus(recurrence: Recurrence) {
    const item = this.projectedRecurrences().find(p => p.id === recurrence.id);
    if (!item) return;

    if (item.status === 'paid') {
      this.markAsUnpaid(item);
    } else {
      this.markAsPaid(item);
    }
  }

  deleteOccurrence(item: any) {
    this.confirmationService.confirm({
      message: `Tem certeza que deseja excluir esta ocorrência de '${item.name}'?`,
      header: 'Confirmar Exclusão',
      icon: 'pi pi-trash',
      acceptLabel: 'Excluir',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text p-button-secondary',
      accept: () => {
        if (item.transactionId) {
          // Real Transaction: Delete it
          this.transactionService.deleteTransaction(item.transactionId).subscribe({
            next: () => {
              this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Transação excluída.' });
              this.loadTransactions();
            },
            error: () => this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Erro ao excluir transação.' })
          });
        } else {
          // Virtual Recurrence: Skip it
          this.recurrenceService.skipRecurrence(item.id, item.dueDate).subscribe({
            next: () => {
              this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Ocorrência removida.' });
              this.loadRecurrences(); // Reload to get updated skipped_dates
            },
            error: () => this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Erro ao remover ocorrência.' })
          });
        }
      }
    });
  }
}
