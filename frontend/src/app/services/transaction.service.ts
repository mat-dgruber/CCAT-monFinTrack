import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Transaction } from '../models/transaction.model';
import { environment } from '../../environments/environment';
import { DashboardService } from './dashboard.service';
import { BudgetService } from './budget.service';
import { AccountService } from './account.service';

@Injectable({
  providedIn: 'root',
})
export class TransactionService {
  private http = inject(HttpClient);
  private dashboardService = inject(DashboardService);
  private budgetService = inject(BudgetService);
  private accountService = inject(AccountService);

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
    return this.http.post<Transaction[]>(this.apiUrl, transaction).pipe(
      tap(() => this.invalidateRelatedCaches())
    );
  }

  // Atualiza uma transação existente
  updateTransaction(
    id: string,
    transaction: Partial<Transaction>,
    scope: string = 'single',
  ): Observable<Transaction> {
    const params = new HttpParams().set('scope', scope);
    return this.http.put<Transaction>(`${this.apiUrl}/${id}`, transaction, {
      params,
    }).pipe(
      tap(() => this.invalidateRelatedCaches())
    );
  }

  deleteTransaction(id: string, scope: string = 'all'): Observable<void> {
    const params = new HttpParams().set('scope', scope);
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { params }).pipe(
      tap(() => this.invalidateRelatedCaches())
    );
  }

  private invalidateRelatedCaches() {
    this.dashboardService.clearCache();
    this.budgetService.clearCache();
    this.accountService.clearCache();
  }

  getUpcomingTransactions(limit: number = 10): Observable<Transaction[]> {
    return this.http.get<Transaction[]>(
      `${this.apiUrl}/upcoming?limit=${limit}`,
    );
  }

  getPendingTithes(): Observable<Transaction[]> {
    return this.http.get<Transaction[]>(`${this.apiUrl}/tithes/pending`);
  }

  payAllTithes(): Observable<any> {
    return this.http.patch(`${this.apiUrl}/tithes/pay-all`, {});
  }
}
