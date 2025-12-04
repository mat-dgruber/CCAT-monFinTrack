import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

// PrimeNG Components
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select'; // Novo Dropdown (v18+)
import { ConfirmationService, MessageService } from 'primeng/api';
import { ColorPickerModule } from 'primeng/colorpicker';
import { SkeletonModule } from 'primeng/skeleton';

// Serviços e Modelos
import { AccountService } from '../../services/account.service';
import { RefreshService } from '../../services/refresh.service';
import { Account } from '../../models/account.model';
import { AccountTypePipe } from '../../pipes/account-type.pipe'; // Pipe de tradução

// Lista de Ícones Compartilhada
import { ICON_LIST } from '../../shared/icons';

@Component({
  selector: 'app-account-manager',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    ColorPickerModule,
    AccountTypePipe,
    SkeletonModule
  ],
  templateUrl: './account-manager.html',
  styleUrl: './account-manager.scss'
})
export class AccountManager implements OnInit {
  // Injeção de Dependências
  private accountService = inject(AccountService);
  private refreshService = inject(RefreshService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);
  private fb = inject(FormBuilder);

  // Signals (Estado)
  accounts = signal<Account[]>([]);
  loading = signal(true);
  visible = signal(false);
  editingId = signal<string | null>(null);

  // Propriedade para o HTML acessar a lista de ícones
  icons = ICON_LIST;

  // Opções de Tipo de Conta
  typeOptions = [
    { label: 'Conta Corrente', value: 'checking' },
    { label: 'Poupança', value: 'savings' },
    { label: 'Cartão de Crédito', value: 'credit_card' },
    { label: 'Carteira / Dinheiro', value: 'cash' },
    { label: 'Investimento', value: 'investment' }
  ];

  // Formulário Reativo
  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    type: ['checking', Validators.required],
    balance: [0, Validators.required],
    icon: ['pi pi-wallet', Validators.required],
    color: ['#3b82f6', Validators.required]
  });

  // Construtor com Efeito (Ouve atualizações do sistema)
  constructor() {
    effect(() => {
      // Registra dependência do sinal de refresh
      this.refreshService.refreshSignal();
      // Recarrega quando o sinal muda (ex: nova transação alterou saldo)
      this.loadAccounts();
    });
  }

  ngOnInit() {
    this.loadAccounts();
  }

  loadAccounts() {
    this.loading.set(true);
    this.accountService.getAccounts().subscribe({
      next: (data) => {
        this.accounts.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Erro ao carregar contas', err);
        this.loading.set(false);
      }
    });
  }

  // Abrir modal para Nova Conta
  openNew() {
    this.editingId.set(null);
    this.form.reset({
      type: 'checking',
      balance: 0,
      icon: 'pi pi-wallet',
      color: '#3b82f6'
    });
    this.visible.set(true);
  }

  // Abrir modal para Editar Conta
  editAccount(event: Event, acc: Account) {
    event.stopPropagation(); // Impede clicar no card de fundo
    event.preventDefault();

    try {
      this.editingId.set(acc.id!);

      // Prepara os dados (com fallback se a conta for antiga e não tiver cor/ícone)
      const dataToPatch = {
        name: acc.name,
        type: acc.type,
        balance: acc.balance,
        icon: acc.icon || 'pi pi-wallet',
        color: acc.color || '#3b82f6'
      };

      this.form.patchValue(dataToPatch);
      this.visible.set(true);
    } catch (e) {
      console.error('Erro ao preparar edição:', e);
    }
  }

  // Deletar Conta
  deleteAccount(event: Event, id: string) {
    event.stopPropagation(); // Impede clicar no card de fundo

    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: 'Tem certeza? Transações antigas podem ficar sem referência.',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: "p-button-danger p-button-text",
      rejectButtonStyleClass: "p-button-text p-button-plain",
      accept: () => {
        this.accountService.deleteAccount(id).subscribe(() => {
          this.messageService.add({ severity: 'success', summary: 'Conta Excluída' });
          this.refreshService.triggerRefresh(); // Avisa o dashboard
        });
      }
    });
  }

  // Salvar (Criação ou Edição)
  saveAccount() {
    if (this.form.valid) {
      const payload = this.form.value as Account;

      const onSave = () => {
        this.visible.set(false);
        this.form.reset();
        this.refreshService.triggerRefresh(); // Avisa dashboard e lista
      };

      if (this.editingId()) {
        this.accountService.updateAccount(this.editingId()!, payload).subscribe(onSave);
      } else {
        this.accountService.createAccount(payload).subscribe(onSave);
      }
    }
  }
}