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
import { TooltipModule } from 'primeng/tooltip';

// Serviços e Modelos
import { AccountService } from '../../services/account.service';
import { RefreshService } from '../../services/refresh.service';
import { Account, CreditCard } from '../../models/account.model';
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
    SkeletonModule,
    TooltipModule
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

  // Opções de Bandeira
  brandOptions = [
      { label: 'Visa', value: 'visa' },
      { label: 'Mastercard', value: 'mastercard' },
      { label: 'Elo', value: 'elo' },
      { label: 'Amex', value: 'amex' },
      { label: 'Hipercard', value: 'hipercard' },
      { label: 'Outro', value: 'other' }
  ];

  // Formulário Reativo da Conta
  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    type: ['checking', Validators.required],
    balance: [0, Validators.required],
    icon: ['pi pi-wallet', Validators.required],
    color: ['#3b82f6', Validators.required]
  });

  // --- Lógica de Cartões de Crédito ---
  // --- Lógica de Cartões de Crédito ---

  
  currentCards = signal<any[]>([]); // Usando any temporariamente para evitar erro de build se interface não estiver importada
  cardVisible = signal(false);
  editingCardIndex = signal<number | null>(null);

  cardForm = this.fb.group({
      name: ['', Validators.required],
      brand: ['mastercard', Validators.required],
      limit: [0, Validators.required],
      closing_day: [1, [Validators.required, Validators.min(1), Validators.max(31)]],
      invoice_due_day: [10, [Validators.required, Validators.min(1), Validators.max(31)]],
      color: ['#000000']
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
    this.currentCards.set([]); // Reset cards
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
      
      // Carrega cartões existentes (se houver)
      if (acc.credit_cards) {
          this.currentCards.set([...acc.credit_cards]);
      } else {
          this.currentCards.set([]);
      }

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
      message: `Tem certeza que deseja excluir a conta '${this.accounts().find(a => a.id === id)?.name}'? Transações antigas podem ficar sem referência.`,
      header: 'Confirmar Exclusão',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Excluir',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text p-button-secondary',
      accept: () => {
        this.accountService.deleteAccount(id).subscribe(() => {
          this.messageService.add({ severity: 'success', summary: 'Conta Excluída' });
          this.refreshService.triggerRefresh(); // Avisa o dashboard
        });
      }
    });
  }

  // --- CRUD de Cartões ---
  openNewCard() {
      this.editingCardIndex.set(null);
      this.cardForm.reset({
          name: '',
          brand: 'mastercard',
          limit: 0,
          closing_day: 1,
          invoice_due_day: 10,
          color: '#000000'
      });
      this.cardVisible.set(true);
  }

  editCard(index: number, card: any) {
      this.editingCardIndex.set(index);
      this.cardForm.patchValue(card);
      this.cardVisible.set(true);
  }

  removeCard(index: number) {
      const cards = this.currentCards();
      cards.splice(index, 1);
      this.currentCards.set([...cards]);
  }

  saveCard() {
      if (this.cardForm.valid) {
          const cardData: any = this.cardForm.value;
          // Gerar ID se for novo
          if (!cardData.id) {
             // Simples ID generator
             (cardData as any).id = Math.random().toString(36).substr(2, 9);
          }

          const cards = [...this.currentCards()];
          
          if (this.editingCardIndex() !== null) {
              cards[this.editingCardIndex()!] = cardData;
          } else {
              cards.push(cardData);
          }
          
          this.currentCards.set(cards);
          this.cardVisible.set(false);
      }
  }

  // Salvar (Criação ou Edição)
  saveAccount() {
    if (this.form.valid) {
      const formVal = this.form.value;
      const payload: Account = {
          name: formVal.name!,
          type: formVal.type as any,
          balance: formVal.balance!,
          icon: formVal.icon!,
          color: formVal.color!,
          credit_cards: this.currentCards() // Inclui lista de cartões
      };

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