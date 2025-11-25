import { Component, OnInit, inject, signal, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';

// PrimeNG Components
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';

// Serviços e Modelos
import { TransactionService } from '../../services/transaction.service';
import { RefreshService } from '../../services/refresh.service';
import { FilterService } from '../../services/filter.service';
import { Transaction } from '../../models/transaction.model';

// Componentes Filhos e Pipes
import { TransactionForm } from '../transaction-form/transaction-form';
import { PaymentFormatPipe } from '../../pipes/payment-format.pipe';

@Component({
  selector: 'app-transaction-list',
  standalone: true,
  imports: [
    CommonModule, 
    TableModule, 
    ButtonModule, 
    TagModule, 
    ConfirmDialogModule,
    ToastModule,
    TransactionForm, 
    PaymentFormatPipe
  ],
  // Nota: ConfirmationService e MessageService estão no app.config.ts, não precisa aqui
  templateUrl: './transaction-list.html',
  styleUrl: './transaction-list.scss',
})
export class TransactionList implements OnInit {

  // Referência ao componente do formulário (para poder abrir o modal)
  @ViewChild(TransactionForm) transactionForm!: TransactionForm;

  private transactionService = inject(TransactionService);
  private refreshService = inject(RefreshService);
  private filterService = inject(FilterService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  // Estado da lista
  transactions = signal<Transaction[]>([]);

  constructor() {
    effect(() => {
        const m = this.filterService.month();
        const y = this.filterService.year();
        this.refreshService.refreshSignal(); // Reage a updates manuais
        
        this.loadTransactions(m, y);
    });
  }

  ngOnInit() {
    // Effect roda 1x no inicio
  }

  loadTransactions(m: number, y: number) {
    this.transactionService.getTransactions(m, y).subscribe({
      next: (data) => {
        console.log('Transactions Data:', data);
        this.transactions.set(data);
      },
      error: (error) => {
        console.error('Erro ao buscar transações:', error);
      }
    });
  }

  // Ação do botão "Nova Transação"
  openNewTransaction() {
    this.transactionForm.showDialog();
  }

  // Ação do botão "Editar" (Lápis)
  editTransaction(event: any, transaction: Transaction) {
    this.transactionForm.editTransaction(event, transaction);
  }

  // Ação do botão "Excluir" (Lixeira)
  deleteTransaction(event: Event, transaction: Transaction) {
    this.confirmationService.confirm({
        target: event.target as EventTarget,
        message: `Tem certeza que deseja excluir esta transação de ${transaction.description}?`,
        header: 'Confirmar Exclusão',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Sim, excluir',
        rejectLabel: 'Cancelar',
        acceptButtonStyleClass: "p-button-danger p-button-text",
        rejectButtonStyleClass: "p-button-text p-button-plain",
        
        accept: () => {
            this.transactionService.deleteTransaction(transaction.id).subscribe({
                next: () => {
                    this.messageService.add({ 
                        severity: 'success', 
                        summary: 'Sucesso', 
                        detail: 'Transação excluída e saldo estornado.' 
                    });
                    
                    // 1. Recarrega a lista local
                    this.loadTransactions(this.filterService.month(), this.filterService.year());
                    
                    // 2. Avisa o resto do app (Dashboard/Contas) para atualizar saldos
                    this.refreshService.triggerRefresh();
                },
                error: (err) => {
                    console.error(err);
                    this.messageService.add({ 
                        severity: 'error', 
                        summary: 'Erro', 
                        detail: 'Não foi possível excluir.' 
                    });
                }
            });
        }
    });
  }
}
