import { Component, OnInit, inject, signal, ViewChild, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// PrimeNG Components
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { ConfirmationService, MessageService } from 'primeng/api';

// Serviços e Modelos
import { TransactionService } from '../../services/transaction.service';
import { CategoryService } from '../../services/category.service';
import { RefreshService } from '../../services/refresh.service';
import { FilterService } from '../../services/filter.service';
import { RecurrenceService } from '../../services/recurrence.service';
import { Transaction } from '../../models/transaction.model';
import { Category } from '../../models/category.model';
import { Recurrence } from '../../models/recurrence.model';

// Componentes Filhos e Pipes
import { TransactionForm } from '../transaction-form/transaction-form';
import { PaymentFormatPipe } from '../../pipes/payment-format.pipe';

@Component({
  selector: 'app-transaction-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    TagModule,
    SelectModule,
    TransactionForm,
    PaymentFormatPipe
  ],
  templateUrl: './transaction-list.html',
  styleUrl: './transaction-list.scss',
})
export class TransactionList implements OnInit {

  @ViewChild(TransactionForm) transactionForm!: TransactionForm;

  private transactionService = inject(TransactionService);
  private categoryService = inject(CategoryService);
  private recurrenceService = inject(RecurrenceService);
  private refreshService = inject(RefreshService);
  private filterService = inject(FilterService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  // Estado
  rawTransactions = signal<Transaction[]>([]);
  categories = signal<Category[]>([]);
  flatCategories = signal<any[]>([]); // Categorias formatadas para o dropdown
  selectedCategory = signal<Category | null>(null);

  // Novos Estados
  recurrences = signal<Recurrence[]>([]);
  upcomingTransactions = signal<Transaction[]>([]);

  // Filtros de Data
  filterOptions = [
    { label: 'Este Mês', value: 'this_month' },
    { label: 'Esta Semana', value: 'this_week' },
    { label: 'Mês Passado', value: 'last_month' },
    { label: 'Este Ano', value: 'this_year' },
    { label: 'Todas', value: 'all' }
  ];
  selectedFilter = signal<string>('this_month');

  // Transações Filtradas (Computado)
  transactions = computed(() => {
    const all = this.rawTransactions();
    const cat = this.selectedCategory();

    if (!cat) return all;

    // Se for subcategoria (tem parent_id), filtra exato
    if (cat.parent_id) {
      return all.filter(t => t.category_id === cat.id);
    }

    // Se for categoria pai, traz ela E suas filhas
    return all.filter(t =>
      t.category_id === cat.id || t.category?.parent_id === cat.id
    );
  });

  constructor() {
    effect(() => {
      const m = this.filterService.month();
      const y = this.filterService.year();
      const filter = this.selectedFilter(); // React to filter changes

      this.refreshService.refreshSignal();

      this.loadTransactions(m, y);
      this.loadRecurrences();
      this.loadUpcomingTransactions();
    });
  }

  ngOnInit() {
    this.loadCategories();
  }

  loadCategories() {
    this.categoryService.getCategories().subscribe({
      next: (data) => {
        this.categories.set(data);
        this.processCategoriesForDropdown(data);
      },
      error: (err) => console.error('Erro ao carregar categorias', err)
    });
  }

  processCategoriesForDropdown(categories: Category[]) {
    const flattened: any[] = [];

    // Separa pais e filhos
    const parents = categories.filter(c => !c.parent_id);

    parents.forEach(parent => {
      // Adiciona o Pai
      flattened.push({
        label: parent.name,
        value: parent,
        styleClass: 'font-bold'
      });

      // Busca filhos deste pai
      const children = categories.filter(c => c.parent_id === parent.id);
      children.forEach(child => {
        flattened.push({
          label: `— ${child.name}`, // Indentação visual
          value: child,
          styleClass: 'pl-4' // Padding via classe (opcional se o dropdown suportar)
        });
      });
    });

    this.flatCategories.set(flattened);
  }

  loadTransactions(m?: number, y?: number) {
    const month = m ?? this.filterService.month();
    const year = y ?? this.filterService.year();
    const filter = this.selectedFilter();

    let startDate: string | undefined;
    let endDate: string | undefined;

    if (filter === 'this_month') {
      // Default behavior: use month/year from filterService
      // No need to set startDate/endDate, backend uses month/year
    } else if (filter === 'all') {
      // Send nothing to get all (backend needs to handle no month/year/dates as "all" or we send explicit nulls)
      // Actually backend requires month/year OR dates. If we want ALL, we might need to not send month/year.
      // But getTransactions signature expects month/year.
      // Let's modify getTransactions to allow nulls or handle it here.
      // If filter is 'all', we pass undefined for month/year/dates.
      this.transactionService.getTransactions(undefined, undefined, undefined, undefined, undefined).subscribe({
        next: (data) => this.rawTransactions.set(data),
        error: (err) => console.error(err)
      });
      return;
    } else {
      // Calculate dates for other filters
      const range = this.calculateDateRange(filter);
      if (range) {
        startDate = range.start.toISOString();
        endDate = range.end.toISOString();
        // When using specific dates, we ignore the global month/year selector
        this.transactionService.getTransactions(undefined, undefined, undefined, startDate, endDate).subscribe({
          next: (data) => this.rawTransactions.set(data),
          error: (err) => console.error(err)
        });
        return;
      }
    }

    // Default fallback (This Month)
    this.transactionService.getTransactions(month, year).subscribe({
      next: (data) => {
        this.rawTransactions.set(data);
      },
      error: (error) => {
        console.error('Erro ao buscar transações:', error);
      }
    });
  }

  calculateDateRange(filter: string): { start: Date, end: Date } | null {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);

    if (filter === 'this_week') {
      const day = now.getDay(); // 0 (Sun) - 6 (Sat)
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (filter === 'last_month') {
      start.setMonth(now.getMonth() - 1);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(now.getMonth());
      end.setDate(0); // Last day of previous month
      end.setHours(23, 59, 59, 999);
    } else if (filter === 'this_year') {
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(11, 31);
      end.setHours(23, 59, 59, 999);
    } else {
      return null;
    }

    return { start, end };
  }

  loadRecurrences() {
    this.recurrenceService.getRecurrences(true).subscribe({
      next: (data) => this.recurrences.set(data),
      error: (err) => console.error('Erro ao carregar recorrências', err)
    });
  }

  loadUpcomingTransactions() {
    this.transactionService.getUpcomingTransactions().subscribe({
      next: (data) => this.upcomingTransactions.set(data),
      error: (err) => console.error('Erro ao carregar transações futuras', err)
    });
  }

  openNewTransaction() {
    this.transactionForm.showDialog();
  }

  editTransaction(event: any, transaction: Transaction) {
    this.transactionForm.editTransaction(event, transaction);
  }

  deleteTransaction(event: Event, transaction: Transaction) {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `Tem certeza que deseja excluir esta transação de ${transaction.description}?`,
      header: 'Confirmar Exclusão',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sim, excluir',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: "p-button-danger p-button-text",
      rejectButtonStyleClass: "p-button-text p-button-plain",

      accept: () => {
        this.transactionService.deleteTransaction(transaction.id).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Sucesso',
              detail: 'Transação excluída e saldo estornado.'
            });
            this.loadTransactions(this.filterService.month(), this.filterService.year());
            this.refreshService.triggerRefresh();
          },
          error: (err) => {
            console.error(err);
            this.messageService.add({
              severity: 'error',
              summary: 'Erro',
              detail: 'Não foi possível excluir.'
            });
          }
        });
      }
    });
  }
}
