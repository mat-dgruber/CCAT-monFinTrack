// 1. Adicione 'effect' nos imports
import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

// PrimeNG imports...
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';

import { AccountService } from '../../services/account.service';
import { RefreshService } from '../../services/refresh.service';
import { Account } from '../../models/account.model';
import { AccountTypePipe } from '../../pipes/account-type.pipe';

@Component({
  selector: 'app-account-manager',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, ButtonModule, TableModule, 
    DialogModule, InputTextModule, InputNumberModule, SelectModule, ConfirmDialogModule, AccountTypePipe
  ],
  templateUrl: './account-manager.html',
  styleUrl: './account-manager.scss'
})
export class AccountManager implements OnInit {
  private accountService = inject(AccountService);
  private refreshService = inject(RefreshService); // <--- Garanta que isso está injetado
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);
  private fb = inject(FormBuilder);

  accounts = signal<Account[]>([]);
  visible = signal(false);
  editingId = signal<string | null>(null);

  typeOptions = [
    { label: 'Conta Corrente', value: 'checking' },
    { label: 'Poupança', value: 'savings' },
    { label: 'Cartão de Crédito', value: 'credit_card' },
    { label: 'Carteira / Dinheiro', value: 'cash' },
    { label: 'Investimento', value: 'investment' }
  ];

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    type: ['checking', Validators.required],
    balance: [0, Validators.required]
  });

  // --- O TRECHO QUE FALTA ---
  constructor() {
    // Esse 'efeito' roda sempre que alguém chama o triggerRefresh()
    effect(() => {
        // Apenas acessamos o sinal para registrar a dependência
        this.refreshService.refreshSignal();
        
        // Recarregamos a lista de contas para pegar os saldos novos
        this.loadAccounts();
    });
  }
  // --------------------------

  ngOnInit() {
    this.loadAccounts();
  }

  loadAccounts() {
    this.accountService.getAccounts().subscribe(data => this.accounts.set(data));
  }

  // ... (o resto dos métodos openNew, editAccount, deleteAccount continuam iguais)
  openNew() {
    this.editingId.set(null);
    this.form.reset({ type: 'checking', balance: 0 });
    this.visible.set(true);
  }

  editAccount(acc: Account) {
    this.editingId.set(acc.id!);
    this.form.patchValue(acc);
    this.visible.set(true);
  }

  deleteAccount(event: Event, id: string) {
    this.confirmationService.confirm({
        target: event.target as EventTarget,
        message: 'Tem certeza? Transações antigas podem ficar sem referência.',
        icon: 'pi pi-exclamation-triangle',
        accept: () => {
            this.accountService.deleteAccount(id).subscribe(() => {
                this.messageService.add({severity:'success', summary:'Conta Excluída'});
                // Ao deletar uma conta, também avisamos o sistema
                this.refreshService.triggerRefresh();
            });
        }
    });
  }

  saveAccount() {
    if (this.form.valid) {
      const payload = this.form.value as Account;
      
      const onSave = () => {
          this.visible.set(false);
          this.form.reset();
          // Ao salvar, avisamos o sistema
          this.refreshService.triggerRefresh();
      };

      if (this.editingId()) {
          this.accountService.updateAccount(this.editingId()!, payload).subscribe(onSave);
      } else {
          this.accountService.createAccount(payload).subscribe(onSave);
      }
    }
  }
}