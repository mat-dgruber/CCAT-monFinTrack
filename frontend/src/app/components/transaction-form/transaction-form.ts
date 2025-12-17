import { Component, EventEmitter, Output, inject, signal, OnInit, computed, DestroyRef } from '@angular/core';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { TooltipModule } from 'primeng/tooltip';
import { SelectItemGroup, SelectItem, ConfirmationService, MessageService } from 'primeng/api';

import { CategoryService } from '../../services/category.service';
import { TransactionService } from '../../services/transaction.service';
import { AccountService } from '../../services/account.service';
import { RefreshService } from '../../services/refresh.service';
import { UserPreferenceService } from '../../services/user-preference.service';
import { AIService } from '../../services/ai.service';
import { debounceTime, distinctUntilChanged, filter, switchMap, tap } from 'rxjs/operators';

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
    TooltipModule,
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
  private aiService = inject(AIService);

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

  titheTooltip = computed(() => {
    if (!this.titheEnabled() && !this.offeringEnabled()) return '';

    const amount = this.form.get('amount')?.value || 0;
    let tithe = 0;
    let offering = 0;

    if (this.titheEnabled()) {
        const tVal = this.form.get('tithe_value')?.value || 0;
        tithe = this.titheType() === 'percentage' ? (amount * tVal) / 100 : tVal;
    }

    if (this.offeringEnabled()) {
        const oVal = this.form.get('offering_value')?.value || 0;
        offering = this.offeringType() === 'percentage' ? (amount * oVal) / 100 : oVal;
    }

    const total = tithe + offering;
    return `Dízimo: ${tithe.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} \nOferta: ${offering.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} \nTotal Deduções: ${total.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}`;
  });

  categories = signal<Category[]>([]);
  accounts = signal<Account[]>([]);
  editingId = signal<string | null>(null);

  @Output() save = new EventEmitter<void>();

  currentType = signal<'expense' | 'income' | 'transfer'>('expense');

  filteredCategories = computed<SelectItemGroup[]>(() => {
      let type = this.currentType();
      if (type === 'transfer') type = 'expense'; // Transfers use expense categories
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
    { label: 'Receitas', value: 'income' }
  ];

  modeOptions = [
    { label: 'Única', value: 'single' },
    { label: 'Parcelada', value: 'installments' },
    { label: 'Recorrente', value: 'recurrence' }
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
    { label: 'Dinheiro', value: 'cash' },
    { label: 'Transferência', value: 'bank_transfer' },
    { label: 'Boleto', value: 'bank_slip' }
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
            // Only clear category if we are interacting (not during initial patch if it matches)
            // But getting context is hard. Simplest is to check if the current category type mismatches.
            const currentCat = this.form.get('category')?.value;
            if (currentCat && currentCat.type !== val) {
                 this.form.patchValue({ category: null });
            }
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



    // AI Classification logic
    this.form.get('title')?.valueChanges.pipe(
        takeUntilDestroyed(),
        debounceTime(1500),
        distinctUntilChanged(),
        filter(val => val && val.length > 2), // At least 3 chars
        tap(() => console.log('AI Checking...')),
        switchMap(val => this.aiService.classifyTransaction(val))
    ).subscribe({
        next: (res) => {
            if (res.category_id) {
                // Check if current category is empty or system wants to suggest
                // We only override if category is null to avoid annoying user overwrites
                const currentCat = this.form.get('category')?.value;
                if (!currentCat) {
                     const cat = this.categories().find(c => c.id === res.category_id);
                     if (cat) {
                         this.form.patchValue({ category: cat });
                         this.messageService.add({ severity: 'info', summary: '✨ AI Magic', detail: `Categoria sugerida: ${cat.name}`, life: 3000 });
                     }
                }
            }
        },
        error: (err) => console.error('AI Error', err)
    });

  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
        this.messageService.add({ severity: 'info', summary: 'Processando...', detail: 'Lendo comprovante com IA...', life: 3000 });
        
        this.aiService.scanReceipt(file).subscribe({
            next: (data) => {
                const patch: any = {};
                if (data.title) patch.title = data.title;
                if (data.amount) patch.amount = data.amount;
                if (data.date) patch.date = new Date(data.date);
                
                // Try to match category
                if (data.category_id) {
                    const cat = this.categories().find(c => c.id === data.category_id);
                    if (cat) patch.category = cat;
                }
                
                this.form.patchValue(patch);
                this.messageService.add({ severity: 'success', summary: 'Dados Extraídos!', detail: 'Verifique os campos preenchidos.' });
            },
            error: (err) => {
                console.error('Scan Error', err);
                this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao ler comprovante.' });
            }
        });
    }
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
        } else {
            this.form.patchValue({ offering_value: null });
        }

        if (prefs.auto_apply_offering) {
             this.offeringEnabled.set(true);
             this.offeringType.set('percentage'); // Default
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

        // Helper to find matching object reference
        const foundCategory = this.categories().find(c => c.id === transaction.category.id) || transaction.category;
        const foundAccount = this.accounts().find(a => a.id === transaction.account.id) || transaction.account;

        this.form.patchValue({
            title: transaction.title,
            description: transaction.description,

            // Use GROSS amount if available (meaning we saved as NET previously)
            amount: transaction.gross_amount || transaction.amount,
            date: new Date(transaction.date),
            category: foundCategory,
            account: foundAccount,
            // Patch type with emitEvent: false to prevent clearing category
            // But we can't easily do partial patch with options.
            // Better: We handled the clearing logic in constructor to be smarter.
            type: transaction.type,
            payment_method: transaction.payment_method,
            mode: mode,
            total_installments: transaction.total_installments || 2,
            recurrence_periodicity: transaction.recurrence_periodicity || 'monthly',
            is_paid: transaction.status === 'paid',



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
        payment_date: formValue.is_paid ? formValue.date : null // Reuse date as payment_date
      };

      // Clean up payload
      delete payload.category;
      delete payload.account;
      delete payload.is_paid;
      delete payload.mode; // 'mode' is internal UI state
      // 'recurrence_periodicity' is valid if mode was recurrence, handled below

      // Handle Net vs Gross Amount Logic for Income with Tithes
      if (formValue.type === 'income' && this.preferences()?.enable_tithes_offerings) {
           const currentAmount = formValue.amount;
           // Always save gross amount so we don't lose the original value on edits
           payload.gross_amount = currentAmount;

           // If Tithe Returned is checked, we want to debit the Net Amount from balance
           // So we save the main 'amount' as the Net Amount.
           if (this.titheEnabled() && this.titheReturned()) {
               payload.amount = this.netAmount();
           } else {
               // Otherwise, save the full amount
               payload.amount = currentAmount;
           }
      } else {
           // Clear gross amount if not applicable
           payload.gross_amount = null;
      }

      if (formValue.mode === 'recurrence') {
          payload.is_recurrence = true;
      } else {
          payload.is_recurrence = false;
          payload.recurrence_periodicity = null;
      }

      if (formValue.mode !== 'installments') {
          payload.total_installments = null;
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
            next: (res: any) => {
                this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Transação criada.' });
                
                // Check for Anomaly Warning
                if (Array.isArray(res) && res.length > 0 && res[0].warning) {
                    this.messageService.add({ 
                        severity: 'warn', 
                        summary: 'Gasto Atípico', 
                        detail: res[0].warning, 
                        life: 10000 
                    });
                }
                
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
      acceptLabel: 'Excluir',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text p-button-secondary',
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
