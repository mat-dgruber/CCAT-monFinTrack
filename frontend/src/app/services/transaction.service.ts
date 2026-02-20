import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Transaction } from '../models/transaction.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class TransactionService {
  private http = inject(HttpClient);

  private apiUrl = `${environment.apiUrl}/transactions`;

  getTransactions(
    month?: number,
    year?: number,
    limit?: number,
    startDate?: string,
    endDate?: string,
  ): Observable<Transaction[]> {
    let params = new HttpParams();
    if (month) params = params.set('month', month.toString());
    if (year) params = params.set('year', year.toString());
    if (limit) params = params.set('limit', limit.toString());
    if (startDate) params = params.set('start_date', startDate);
    if (endDate) params = params.set('end_date', endDate);

    return this.http.get<Transaction[]>(this.apiUrl, { params });
  }

  createTransaction(transaction: Transaction): Observable<Transaction[]> {
    return this.http.post<Transaction[]>(this.apiUrl, transaction);
  }

  // Atualiza uma transação existente
  updateTransaction(
    id: string,
    transaction: Partial<Transaction>,
  ): Observable<Transaction> {
    return this.http.put<Transaction>(`${this.apiUrl}/${id}`, transaction);
  }

  deleteTransaction(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getUpcomingTransactions(limit: number = 10): Observable<Transaction[]> {
    return this.http.get<Transaction[]>(
      `${this.apiUrl}/upcoming?limit=${limit}`,
    );
  }
}
