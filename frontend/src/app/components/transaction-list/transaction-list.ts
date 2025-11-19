import { Component, OnInit, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';

import { PaymentFormatPipe } from '../../pipes/payment-format.pipe';
 
import { TransactionService } from '../../services/transaction.service';
import { Transaction } from '../../models/transaction.model';
import { TransactionForm } from '../transaction-form/transaction-form';


@Component({
  selector: 'app-transaction-list',
  standalone: true,
  imports: [CommonModule, TableModule, ButtonModule, TagModule, TransactionForm, PaymentFormatPipe],
  templateUrl: './transaction-list.html',
  styleUrl: './transaction-list.scss',
})
export class TransactionList implements OnInit{

  @ViewChild(TransactionForm) transactionForm!: TransactionForm;


  private transactionService = inject(TransactionService)

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



}
