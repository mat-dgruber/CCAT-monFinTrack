import { Component, OnInit, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

// PrimeNG
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';

import { PaymentFormatPipe } from '../../pipes/payment-format.pipe';
 
import { TransactionService } from '../../services/transaction.service';
import { Transaction } from '../../models/transaction.model';
import { TransactionForm } from '../transaction-form/transaction-form';
import { RefreshService } from '../../services/refresh.service';


@Component({
  selector: 'app-transaction-list',
  standalone: true,
  imports: [CommonModule, TableModule, ButtonModule, TagModule, TransactionForm, PaymentFormatPipe, ConfirmDialogModule, ToastModule],
  templateUrl: './transaction-list.html',
  styleUrl: './transaction-list.scss',
})
export class TransactionList implements OnInit{

  @ViewChild(TransactionForm) transactionForm!: TransactionForm;


  private transactionService = inject(TransactionService)
  private refreshService = inject(RefreshService);
  private confirmationService = inject(ConfirmationService)
  private messageService = inject(MessageService);

  transactions = signal<Transaction[]>([]);

  ngOnInit() {
    this.loadTransactions();
  }

  loadTransactions() {
    this.transactionService.getTransactions().subscribe({
      next: (data) => {
        this.transactions.set(data);
        console.log('Dados recebidos:', data);
      },
      error: (error) => console.error('Erro ao buscar transações:', error)
    })
  }

  openNewTransaction() {
    this.transactionForm.showDialog();
  }

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
                    // 1. Mostra mensagem
                    this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Transação excluída e saldo estornado.' });
                    
                    // 2. Atualiza a lista local
                    this.loadTransactions();
                    
                    // 3. Avisa o Dashboard e Contas para atualizarem o saldo!
                    this.refreshService.triggerRefresh();
                },
                error: () => {
                    this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível excluir.' });
                }
            });
        }
    });
  }



}
