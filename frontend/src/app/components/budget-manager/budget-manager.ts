import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

// PrimeNG
import { ProgressBarModule } from 'primeng/progressbar'; // <--- NOVO
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';

import { BudgetService } from '../../services/budget.service';
import { CategoryService } from '../../services/category.service';
import { RefreshService } from '../../services/refresh.service';
import { Budget } from '../../models/budget.model';
import { Category } from '../../models/transaction.model';

@Component({
  selector: 'app-budget-manager',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, ProgressBarModule, ButtonModule, 
    DialogModule, InputNumberModule, SelectModule, ConfirmDialogModule
  ],
  templateUrl: './budget-manager.html',
  styleUrl: './budget-manager.scss'
})
export class BudgetManager implements OnInit {
  private budgetService = inject(BudgetService);
  private categoryService = inject(CategoryService);
  private refreshService = inject(RefreshService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);
  private fb = inject(FormBuilder);

  budgets = signal<Budget[]>([]);
  categories = signal<Category[]>([]); // Para o dropdown
  visible = signal(false);

  editingId = signal<string | null>(null);

  form = this.fb.group({
    category: [null as Category | null, Validators.required],
    amount: [null as number | null, [Validators.required, Validators.min(1)]]
  });

  constructor() {
    // Se adicionar uma despesa nova, atualiza as barras de progresso
    effect(() => {
        this.refreshService.refreshSignal();
        this.loadBudgets();
    });
  }

  ngOnInit() {
    this.loadBudgets();
    this.loadCategories();
  }

  loadBudgets() {
    this.budgetService.getBudgets().subscribe(data => this.budgets.set(data));
  }

  loadCategories() {
    this.categoryService.getCategories().subscribe(data => this.categories.set(data));
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
    this.confirmationService.confirm({
        target: event.target as EventTarget,
        message: 'Excluir esta meta de orçamento?',
        icon: 'pi pi-trash',
        accept: () => {
            this.budgetService.deleteBudget(id).subscribe(() => {
                this.messageService.add({severity:'success', summary:'Meta Removida'});
                this.loadBudgets();
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
            this.loadBudgets();
            this.messageService.add({
                severity:'success', 
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