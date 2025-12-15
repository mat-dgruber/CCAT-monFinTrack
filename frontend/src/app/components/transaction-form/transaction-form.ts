import { Component, EventEmitter, Output, inject, signal, OnInit, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

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
import { UserPreferenceService } from '../../services/user-preference.service';

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
    FormsModule,
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
  private preferenceService = inject(UserPreferenceService);

  visible = signal(false);
  preferences = toSignal(this.preferenceService.preferences$);

  // Tithes & Offerings State
  titheEnabled = signal(false);
  titheType = signal<'percentage' | 'value'>('percentage');
  titheReturned = signal(false);
  offeringEnabled = signal(false);
  offeringType = signal<'percentage' | 'value'>('value');

  netAmount = computed(() => {
      const amount = this.form.get('amount')?.value || 0;
      let tithe = 0;
      let offering = 0;

      if (this.titheEnabled()) {
          const tVal = this.form.get('tithe_value')?.value || 0;
          if (this.titheType() === 'percentage') {
              tithe = (amount * tVal) / 100;
          } else {
              tithe = tVal;
          }
      }

      if (this.offeringEnabled()) {
          const oVal = this.form.get('offering_value')?.value || 0;
          if (this.offeringType() === 'percentage') {
              offering = (amount * oVal) / 100;
          } else {
              offering = oVal;
          }
      }

      return Math.max(0, amount - tithe - offering);
  });

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
    credit_card_id: [null], // Novo campo

    mode: ['single'],
    total_installments: [2],
    recurrence_periodicity: ['monthly'],
    recurrence_auto_pay: [false],
    recurrence_create_first: [true],

    is_paid: [true],
    payment_date: [new Date()],

    // Tithes & Offerings
    tithe_value: [10], // Default 10%
    offering_value: [null]
  });

  availableCreditCards = signal<any[]>([]);

  constructor() {
    this.form.get('type')?.valueChanges.subscribe(val => {
        if (val) {
            this.currentType.set(val);
            this.form.patchValue({ category: null });
        }
    });

    // Listen to Account Changes to load cards
    this.form.get('account')?.valueChanges.subscribe((acc: Account | null) => {
        if (acc && acc.credit_cards && acc.credit_cards.length > 0) {
            this.availableCreditCards.set(acc.credit_cards);
        } else {
            this.availableCreditCards.set([]);
            this.form.patchValue({ credit_card_id: null });
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

    // Apply Defaults
    const prefs = this.preferences();
    if (prefs?.enable_tithes_offerings) {
        if (prefs.auto_apply_tithe) {
             this.titheEnabled.set(true);
             this.form.patchValue({ tithe_value: prefs.default_tithe_percentage ?? 10 });
             this.titheType.set('percentage'); // Default to percentage for tithe usually
        } else {
             this.titheEnabled.set(false);
             this.form.patchValue({ tithe_value: prefs.default_tithe_percentage ?? 10 });
        }
        this.titheReturned.set(false);

        this.offeringEnabled.set(false);
        if (prefs.default_offering_percentage) {
            this.form.patchValue({ offering_value: prefs.default_offering_percentage });
            this.offeringType.set('percentage');
        } else {
            this.form.patchValue({ offering_value: null });
        }
    } else {
        this.titheEnabled.set(false);
        this.offeringEnabled.set(false);
        this.titheReturned.set(false);
    }

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
        payment_date: transaction.payment_date ? new Date(transaction.payment_date) : new Date(transaction.date),

        // Tithes
        tithe_value: transaction.tithe_percentage || transaction.tithe_amount || (this.preferences()?.default_tithe_percentage ?? 10),
        offering_value: transaction.offering_percentage || transaction.offering_amount || null,

        credit_card_id: transaction.credit_card_id || null
    });

    if (transaction.tithe_percentage) {
        this.titheEnabled.set(true);
        this.titheType.set('percentage');
    } else if (transaction.tithe_amount) {
        this.titheEnabled.set(true);
        this.titheType.set('value');
    } else {
        this.titheEnabled.set(false);
    }

    if (transaction.tithe_status === 'PAID') {
        this.titheReturned.set(true);
    } else {
        this.titheReturned.set(false);
    }

    if (transaction.offering_percentage) {
        this.offeringEnabled.set(true);
        this.offeringType.set('percentage');
    } else if (transaction.offering_amount) {
        this.offeringEnabled.set(true);
        this.offeringType.set('value');
    } else {
        this.offeringEnabled.set(false);
    }

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

      // Add Tithes & Offerings Data if Income
      if (formValue.type === 'income' && this.preferences()?.enable_tithes_offerings) {
          const amount = formValue.amount;

          if (this.titheEnabled()) {
              const tVal = formValue.tithe_value;
              if (this.titheType() === 'percentage') {
                  payload.tithe_percentage = tVal;
                  payload.tithe_amount = (amount * tVal) / 100;
              } else {
                  payload.tithe_amount = tVal;
                  payload.tithe_percentage = null;
              }

              // Status Logic
              payload.tithe_status = this.titheReturned() ? 'PAID' : 'PENDING';
          } else {
              payload.tithe_amount = null;
              payload.tithe_percentage = null;
              payload.tithe_status = 'NONE';
          }

          if (this.offeringEnabled()) {
              const oVal = formValue.offering_value;
              if (this.offeringType() === 'percentage') {
                  payload.offering_percentage = oVal;
                  payload.offering_amount = (amount * oVal) / 100;
              } else {
                  payload.offering_amount = oVal;
                  payload.offering_percentage = null;
              }
          } else {
              payload.offering_amount = null;
              payload.offering_percentage = null;
          }

          payload.net_amount = this.netAmount();
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
