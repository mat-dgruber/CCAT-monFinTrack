import { Component, EventEmitter, Output, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

// PrimeNG Imports
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SelectItemGroup, SelectItem, ConfirmationService, MessageService } from 'primeng/api';

import { CategoryService } from '../../services/category.service';
import { TransactionService } from '../../services/transaction.service';
import { AccountService } from '../../services/account.service';
import { RefreshService } from '../../services/refresh.service';

import { Category } from '../../models/category.model';
import { Transaction } from '../../models/transaction.model';
import { Account } from '../../models/account.model';

import { AccountTypePipe } from '../../pipes/account-type.pipe';

@Component({
  selector: 'app-transaction-form',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    DialogModule, 
    ButtonModule, 
    InputTextModule, 
    InputNumberModule, 
    SelectModule, 
    DatePickerModule, 
    SelectButtonModule,
    AccountTypePipe
  ],
  templateUrl: './transaction-form.html',
  styleUrl: './transaction-form.scss',
})
export class TransactionForm implements OnInit {
  private fb = inject(FormBuilder);
  private categoryService = inject(CategoryService);
  private transactionService = inject(TransactionService);
  private accountService = inject(AccountService);
  private refreshService = inject(RefreshService);
  private confirmationService = inject(ConfirmationService); // Injeta o ConfirmationService
  private messageService = inject(MessageService); // Injeta o MessageService

  visible = signal(false);
  
  // Lista completa do banco
  categories = signal<Category[]>([]); 
  accounts = signal<Account[]>([]);
  editingId = signal<string | null>(null);
  
  @Output() save = new EventEmitter<void>();

  // Signal para rastrear o tipo atual (expense/income)
  currentType = signal<'expense' | 'income'>('expense');

  // 4. CORREÇÃO: Signal Computado para filtrar a lista automaticamente
  filteredCategories = computed<SelectItemGroup[]>(() => {
      const type = this.currentType();
      const all = this.categories();
      // Filter roots by type
      const roots = all.filter(c => c.type === type);
      
      return roots.map(root => {
          const items = [root, ...(root.subcategories || [])];
          
          return {
              label: root.name,
              value: root.id,
              items: items.map(c => ({
                  label: c.name,
                  value: c,
                  icon: c.icon,
                  color: c.color
              } as SelectItem))
          };
      });
  });

  typeOptions = [
    { label: 'Despesas', value: 'expense' },
    { label: 'Receitas', value: 'income' },
  ];

  paymentOptions = [
    { label: 'Cartão de Crédito', value: 'credit_card' },
    { label: 'Débito', value: 'debit_card' },
    { label: 'Pix', value: 'pix' },
    { label: 'Dinheiro', value: 'cash' }
  ];

  form: FormGroup = this.fb.group({
    description: ['', [Validators.required, Validators.minLength(3)]],
    amount: [null, [Validators.required, Validators.min(0.01)]],
    date: [new Date(), Validators.required],
    category: [null, Validators.required],
    account: [null, Validators.required],
    type: ['expense', Validators.required],
    payment_method: [null, Validators.required]
  });

  constructor() {
      // 5. CORREÇÃO: Monitorar mudança no formulário para atualizar o filtro
      this.form.get('type')?.valueChanges.subscribe(val => {
          if (val) {
              this.currentType.set(val); // Atualiza o signal -> Atualiza o computed
              // Limpa a categoria selecionada pois ela pode não existir no novo tipo
              this.form.patchValue({ category: null });
          }
      });
  }

  ngOnInit() {
    this.loadCategories();
    this.loadAccounts();
  }

  loadCategories() {
    this.categoryService.getCategories().subscribe(data => this.categories.set(data));
  }

  loadAccounts() {
    this.accountService.getAccounts().subscribe(data => this.accounts.set(data));
  }

  showDialog() {
    this.editingId.set(null);
    this.currentType.set('expense'); // Reseta o filtro para despesa
    
    this.form.reset({ 
        type: 'expense', 
        date: new Date(), 
        payment_method: null,
        account: null 
    });
    
    this.loadAccounts();
    this.visible.set(true);
  }

  editTransaction(event: Event, transaction: Transaction) {
    event.stopPropagation(); 
    this.editingId.set(transaction.id);
    
    // 6. CORREÇÃO: Sincronizar o filtro com o tipo da transação editada
    this.currentType.set(transaction.type);

    this.form.patchValue({
        description: transaction.description,
        amount: transaction.amount,
        date: new Date(transaction.date), 
        type: transaction.type,
        payment_method: transaction.payment_method,
        category: transaction.category,
        account: transaction.account 
    });

    this.visible.set(true);
  }

  onSubmit() {
    if (this.form.valid) {
      const formValue = this.form.value;
      
      const payload = {
        ...formValue,
        category_id: formValue.category.id,
        account_id: formValue.account.id
      };

      const onSave = () => {
          this.visible.set(false);
          this.form.reset();
          this.save.emit();
          this.refreshService.triggerRefresh();
      };

      if (this.editingId()) {
        this.transactionService.updateTransaction(this.editingId()!, payload).subscribe({
            next: onSave,
            error: (err) => console.error('Erro ao atualizar', err)
        });
      } else {
        this.transactionService.createTransaction(payload).subscribe({
            next: onSave,
            error: (err) => console.error('Erro ao criar', err)
        });
      }
    }
  }

  confirmDelete() {
    this.confirmationService.confirm({
      message: 'Tem certeza que deseja excluir esta transação?',
      header: 'Confirmar Exclusão',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sim',
      rejectLabel: 'Não',
      accept: () => {
        if (this.editingId()) {
          this.transactionService.deleteTransaction(this.editingId()!).subscribe({
            next: () => {
              this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Transação excluída.' });
              this.visible.set(false);
              this.form.reset();
              this.save.emit();
              this.refreshService.triggerRefresh();
            },
            error: () => {
              this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Erro ao excluir transação.' });
            }
          });
        }
      }
    });
  }
}