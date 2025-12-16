import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

// PrimeNG
import { ProgressBarModule } from 'primeng/progressbar';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { ConfirmationService, MessageService } from 'primeng/api';

import { BudgetService } from '../../services/budget.service';
import { CategoryService } from '../../services/category.service';
import { RefreshService } from '../../services/refresh.service';
import { FilterService } from '../../services/filter.service';
import { Budget } from '../../models/budget.model';
import { Category } from '../../models/category.model';

import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-budget-manager',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, ProgressBarModule, ButtonModule,
    DialogModule, InputNumberModule, SelectModule, CurrencyPipe, SkeletonModule
  ],
  providers: [CurrencyPipe],
  templateUrl: './budget-manager.html',
  styleUrl: './budget-manager.scss'
})
export class BudgetManager implements OnInit {
  private budgetService = inject(BudgetService);
  private categoryService = inject(CategoryService);
  private refreshService = inject(RefreshService);
  private filterService = inject(FilterService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);
  private fb = inject(FormBuilder);
  private currencyPipe = inject(CurrencyPipe);

  budgets = signal<Budget[]>([]);
  previousBudgets = signal<Budget[]>([]);
  categories = signal<Category[]>([]); // Para o dropdown
  loading = signal(true);
  visible = signal(false);

  editingId = signal<string | null>(null);

  form = this.fb.group({
    category: [null as Category | null, Validators.required],
    amount: [null as number | null, [Validators.required, Validators.min(1)]]
  });

  constructor() {
    // Se adicionar uma despesa nova, atualiza as barras de progresso
    effect(() => {
      const m = this.filterService.month();
      const y = this.filterService.year();
      this.refreshService.refreshSignal();
      this.loadBudgets(m, y);
    });

    // Effect for budget notifications
    effect(() => {
      const currentBudgets = this.budgets();
      const previousBudgets = this.previousBudgets();

      if (previousBudgets.length === 0) {
        return;
      }

      currentBudgets.forEach(current => {
        const previous = previousBudgets.find(p => p.category?.id === current.category?.id);
        if (!previous) return;

        const oldPercentage = previous.percentage || 0;
        const newPercentage = current.percentage || 0;

        const formatCurrency = (value: number) => this.currencyPipe.transform(value, 'BRL', 'symbol', '1.2-2');


        // Over budget notification
        if (newPercentage >= 100 && oldPercentage < 100) {
          this.messageService.add({
            severity: 'error',
            summary: `Orçamento Estourado: ${current.category?.name}`,
            detail: `Você ultrapassou o limite de ${formatCurrency(current.amount)} para esta categoria.`,
            life: 6000
          });
        }
        // Alert notification
        else if (newPercentage >= 80 && oldPercentage < 80) {
          this.messageService.add({
            severity: 'warn',
            summary: `Alerta de Orçamento: ${current.category?.name}`,
            detail: `Você já utilizou ${newPercentage.toFixed(0)}% do seu orçamento de ${formatCurrency(current.amount)}.`,
            life: 6000
          });
        }
      });
    });
  }

  ngOnInit() {
    // this.loadBudgets(); // Effect ja chama
    this.loadCategories();
  }

  loadBudgets(m: number, y: number) {
    this.loading.set(true);
    this.budgetService.getBudgets(m, y).subscribe({
      next: (data) => {
        this.previousBudgets.set(this.budgets());
        this.budgets.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Erro ao carregar orçamentos', err);
        this.loading.set(false);
      }
    });
  }

  loadCategories() {
    this.categoryService.getCategories('expense').subscribe(data => this.categories.set(data));
  }

  openNew() {
    this.form.reset();
    this.visible.set(true);
    this.editingId.set(null);
  }

  // 3. Crie o método de editar (com proteção de clique e try/catch)
  editBudget(event: Event, budget: Budget) {
    event.stopPropagation(); // Pára o clique (se houver card clicável)

    this.editingId.set(budget.id!);

    // Preenche o formulário
    // O PrimeNG Select é inteligente: se passarmos o objeto categoria completo que veio da lista,
    // e ele for igual ao da lista de opções, ele seleciona sozinho.
    this.form.patchValue({
      category: budget.category,
      amount: budget.amount
    });

    this.visible.set(true);
  }

  deleteBudget(event: Event, id: string) {
    const budget = this.budgets().find(b => b.id === id);
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `Tem certeza que deseja excluir a meta de orçamento para '${budget?.category?.name}'?`,
      header: 'Confirmar Exclusão',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Excluir',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text p-button-secondary',
      accept: () => {
        this.budgetService.deleteBudget(id).subscribe(() => {
          this.messageService.add({ severity: 'success', summary: 'Meta Removida' });
          this.loadBudgets(this.filterService.month(), this.filterService.year());
        });
      }
    });
  }

  // 4. Atualize o onSubmit para lidar com criação OU edição
  onSubmit() {
    if (this.form.valid) {
      const val = this.form.value;
      const payload: Budget = {
        category_id: val.category!.id!,
        amount: val.amount!
      };

      // Função auxiliar para fechar e atualizar
      const onSave = () => {
        this.visible.set(false);
        this.loadBudgets(this.filterService.month(), this.filterService.year());
        this.messageService.add({
          severity: 'success',
          summary: this.editingId() ? 'Meta Atualizada' : 'Meta Criada'
        });
      };

      if (this.editingId()) {
        // MODO EDIÇÃO
        this.budgetService.updateBudget(this.editingId()!, payload).subscribe(onSave);
      } else {
        // MODO CRIAÇÃO
        this.budgetService.createBudget(payload).subscribe(onSave);
      }
    }
  }

  // Helper para cor da barra (Verde -> Amarelo -> Vermelho)
  getProgressColor(percentage: number): string {
    if (percentage >= 100) return '#ef4444'; // Red (Estourou)
    if (percentage >= 80) return '#f59e0b';  // Amber (Alerta)
    return '#22c55e';                         // Green (Ok)
  }
}
