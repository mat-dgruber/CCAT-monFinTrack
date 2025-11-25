import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Transaction } from '../models/transaction.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})

export class TransactionService {

     private http = inject(HttpClient);

     private apiUrl = `${environment.apiUrl}/transactions`;

     getTransactions(): Observable<Transaction[]> {
          return this.http.get<Transaction[]>(this.apiUrl);
     }

     createTransaction(transaction: Transaction): Observable<Transaction> {
          return this.http.post<Transaction>(this.apiUrl, transaction);
     }

     // Atualiza uma transação existente
  updateTransaction(id: string, transaction: Partial<Transaction>): Observable<Transaction> {
    return this.http.put<Transaction>(`${this.apiUrl}/${id}`, transaction);
  }

     deleteTransaction(id: string): Observable<void> {
          // CORREÇÃO: Adicione a barra "/" explicitamente antes do ID
          // Se this.apiUrl for '.../transactions', isso vira '.../transactions/123'
          return this.http.delete<void>(`${this.apiUrl}/${id}`);
        }


}