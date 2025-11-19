import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Transaction } from '../models/transaction.model';

@Injectable({
  providedIn: 'root'
})

export class TransactionService {

     private http = inject(HttpClient);

     private apiUrl = 'http://127.0.0.1:8000/api/transactions';

     getTransactions(): Observable<Transaction[]> {
          return this.http.get<Transaction[]>(this.apiUrl);
     }

     createTransaction(transaction: Transaction): Observable<Transaction> {
          return this.http.post<Transaction>(this.apiUrl, transaction);
     }


}