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
import { CheckboxModule } from 'primeng/checkbox';
import { TextareaModule } from 'primeng/textarea';
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
    CheckboxModule,
    TextareaModule,
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
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  visible = signal(false);

  categories = signal<Category[]>([]);
  accounts = signal<Account[]>([]);
  editingId = signal<string | null>(null);

  @Output() save = new EventEmitter<void>();

  currentType = signal<'expense' | 'income'>('expense');

  filteredCategories = computed<SelectItemGroup[]>(() => {
      const type = this.currentType();
      const all = this.categories();
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

  modeOptions = [
    { label: 'Única', value: 'single' },
    { label: 'Recorrente', value: 'recurrence' },
    { label: 'Parcelada', value: 'installments' }
  ];

  periodicityOptions = [
    { label: 'Mensal', value: 'monthly' },
    { label: 'Semanal', value: 'weekly' },
    { label: 'Anual', value: 'yearly' }
  ];

  paymentOptions = [
    { label: 'Cartão de Crédito', value: 'credit_card' },
    { label: 'Débito', value: 'debit_card' },
    { label: 'Pix', value: 'pix' },
    { label: 'Dinheiro', value: 'cash' }
  ];

  form: FormGroup = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    description: [''],
    amount: [null, [Validators.required, Validators.min(0.01)]],
    date: [new Date(), Validators.required],
    category: [null, Validators.required],
    account: [null, Validators.required],
    type: ['expense', Validators.required],
    payment_method: [null, Validators.required],

    mode: ['single'],
    total_installments: [2],
    recurrence_periodicity: ['monthly'],
    recurrence_auto_pay: [false],
    recurrence_create_first: [true],

    is_paid: [true],
    payment_date: [new Date()]
  });

  constructor() {
    this.form.get('type')?.valueChanges.subscribe(val => {
        if (val) {
            this.currentType.set(val);
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
    this.currentType.set('expense');

    this.form.reset({
        type: 'expense',
        date: new Date(),
        mode: 'single',
        total_installments: 2,
        recurrence_periodicity: 'monthly',
        recurrence_auto_pay: false,
        recurrence_create_first: true,
        is_paid: true,
        payment_date: new Date()
    });

    this.visible.set(true);
  }

  editTransaction(event: Event, transaction: Transaction) {
    event.stopPropagation();
    this.editingId.set(transaction.id);
    this.currentType.set(transaction.type);

    let mode = 'single';
    if (transaction.installment_group_id) mode = 'installments';
    if (transaction.recurrence_id) mode = 'recurrence';

    this.form.patchValue({
        title: transaction.title,
        description: transaction.description,
        amount: transaction.amount,
        date: new Date(transaction.date),
        category: transaction.category,
        account: transaction.account,
        type: transaction.type,
        payment_method: transaction.payment_method,
        mode: mode,
        total_installments: transaction.total_installments || 2,
        recurrence_periodicity: transaction.recurrence_periodicity || 'monthly',
        is_paid: transaction.status === 'paid' || !transaction.status,
        payment_date: transaction.payment_date ? new Date(transaction.payment_date) : new Date(transaction.date)
    });

    this.visible.set(true);
  }

  onSubmit() {
    if (this.form.valid) {
      const formValue = this.form.value;

      const payload: any = {
        ...formValue,
        category_id: formValue.category.id,
        account_id: formValue.account.id,
        status: formValue.is_paid ? 'paid' : 'pending',
        payment_date: formValue.is_paid ? formValue.payment_date : null
      };

      if (formValue.mode === 'recurrence') {
          payload.is_recurrence = true;
      } else if (formValue.mode === 'installments') {
          // total_installments is already in formValue
      } else {
          payload.total_installments = null;
          payload.is_recurrence = false;
      }

      const onSave = () => {
          this.visible.set(false);
          this.form.reset();
          this.save.emit();
          this.refreshService.triggerRefresh();
      };

      if (this.editingId()) {
        this.transactionService.updateTransaction(this.editingId()!, payload).subscribe({
            next: () => {
                this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Transação atualizada.' });
                onSave();
            },
            error: (err) => {
                console.error('Erro ao atualizar', err);
                this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Erro ao atualizar transação.' });
            }
        });
      } else {
        this.transactionService.createTransaction(payload).subscribe({
            next: () => {
                this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Transação criada.' });
                onSave();
            },
            error: (err) => {
                console.error('Erro ao criar', err);
                this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Erro ao criar transação.' });
            }
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
