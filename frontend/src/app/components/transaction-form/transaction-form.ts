import { Component, EventEmitter, Output, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

//PrimeNG Imports
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';        
import { DatePickerModule } from 'primeng/datepicker'; 
import { SelectButtonModule } from 'primeng/selectbutton';

import { RefreshService } from '../../services/refresh.service';
import { CategoryService } from '../../services/category.service';
import { TransactionService } from '../../services/transaction.service';
import { AccountService } from '../../services/account.service';
import { Category, Transaction } from '../../models/transaction.model';
import { Account } from '../../models/account.model';


@Component({
  selector: 'app-transaction-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DialogModule, ButtonModule, InputTextModule, InputNumberModule, SelectModule, DatePickerModule, SelectButtonModule],
  templateUrl: './transaction-form.html',
  styleUrl: './transaction-form.scss',
})
export class TransactionForm implements OnInit{

  private fb = inject(FormBuilder);
  private refreshService = inject(RefreshService);
  private categoryService = inject(CategoryService);
  private transactionService = inject(TransactionService);
  private accountService = inject(AccountService);

  // Variável para saber se estamos editando (null = criando novo)
  editingId = signal<string | null>(null);

  visible = signal(false);
  categories = signal<Category[]>([]);
  accounts = signal<Account[]>([]);

  @Output() save = new EventEmitter<void>();

  typeOptions = [
    { label: 'Despesas', value: 'expense' },
    { label: 'Receitas', value: 'income' },
  ];

  paymentOptions = [
    { label:'Cartão de Crédito', value: 'credit_card' },
    { label: 'Débito', value: 'debit_card' },
    { label: 'Pix', value: 'pix' },
    { label: 'Dinheiro', value: 'cash' }
  ]

  form: FormGroup = this.fb.group({
    description: ['', [Validators.required, Validators.minLength(3)]],
    amount: [null, [Validators.required, Validators.min(0.01)]],
    date: [new Date(), Validators.required],
    category: [null, Validators.required],
    account: [null, Validators.required],
    type: ['expense', Validators.required],
    payment_method: [null, Validators.required]
  });

  ngOnInit() {
    this.loadCategories();  
    this.loadAccounts();
  }

  loadCategories() {
    this.categoryService.getCategories().subscribe(data => {
      this.categories.set(data);
    })
  }

  loadAccounts() {
    this.accountService.getAccounts().subscribe(data => this.accounts.set(data));
  }

  // NOVO MÉTODO: Chamado pelo botão de lápis da lista
  editTransaction(transaction: Transaction) {
    this.editingId.set(transaction.id); // Guarda o ID
    
    // Preenche o formulário com os dados da transação
    this.form.patchValue({
        description: transaction.description,
        amount: transaction.amount,
        // Precisamos converter a string de data de volta para objeto Date
        date: new Date(transaction.date), 
        type: transaction.type,
        payment_method: transaction.payment_method,
        // Para Selects (Dropdowns), passamos o objeto inteiro que está na lista
        category: transaction.category,
        account: transaction.account 
    });

    this.visible.set(true); // Abre o modal
  }

  showDialog() {
    this.editingId.set(null); // Limpa o ID (Modo Criação)
    this.form.reset({ type: 'expense', date: new Date(), payment_method: null, account: null });
    this.loadAccounts(); // Garante dados frescos
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

      // LÓGICA DE DECISÃO: CRIAR OU EDITAR?
      if (this.editingId()) {
        // --- MODO EDIÇÃO ---
        this.transactionService.updateTransaction(this.editingId()!, payload).subscribe({
            next: () => this.handleSuccess('Transação atualizada!'),
            error: (err) => console.error('Erro ao atualizar', err)
        });
      } else {
        // --- MODO CRIAÇÃO ---
        this.transactionService.createTransaction(payload).subscribe({
            next: () => this.handleSuccess('Transação criada!'),
            error: (err) => console.error('Erro ao criar', err)
        });
      }
    }
  }

  // Função auxiliar para limpar código
  private handleSuccess(msg: string) {
      this.visible.set(false);
      this.form.reset();
      this.save.emit(); // Avisa a lista
      this.refreshService.triggerRefresh(); // Avisa o saldo
      console.log(msg);
  }

  
}