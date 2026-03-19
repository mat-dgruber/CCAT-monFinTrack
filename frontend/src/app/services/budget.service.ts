import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, ReplaySubject, of, tap } from 'rxjs';
import { Budget } from '../models/budget.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class BudgetService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/budgets`;

  private budgetCache = new Map<string, ReplaySubject<Budget[]>>();
  private lastFetch = new Map<string, number>();
  private readonly CACHE_TIME = 60000; // 1 minuto em ms (dados de orçamento mudam com transações)

  // GET (Lista com progresso calculado)
  getBudgets(month: number, year: number, forceRefresh = false): Observable<Budget[]> {
    const key = `${month}-${year}`;
    const isExpired = Date.now() - (this.lastFetch.get(key) || 0) > this.CACHE_TIME;

    if (forceRefresh || isExpired || !this.budgetCache.has(key)) {
      if (!this.budgetCache.has(key)) {
        this.budgetCache.set(key, new ReplaySubject<Budget[]>(1));
      }

      return this.http.get<Budget[]>(
        `${this.apiUrl}?month=${month}&year=${year}`,
      ).pipe(
        tap((budgets) => {
          this.budgetCache.get(key)?.next(budgets);
          this.lastFetch.set(key, Date.now());
        })
      );
    }

    return this.budgetCache.get(key)!.asObservable();
  }

  // POST (Criar Meta)
  createBudget(budget: Budget): Observable<Budget> {
    return this.http.post<Budget>(this.apiUrl, budget).pipe(
      tap(() => this.clearCache())
    );
  }

  updateBudget(id: string, budget: Budget): Observable<Budget> {
    return this.http.put<Budget>(`${this.apiUrl}/${id}`, budget).pipe(
      tap(() => this.clearCache())
    );
  }

  // DELETE
  deleteBudget(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.clearCache())
    );
  }

  clearCache() {
    this.budgetCache.clear();
    this.lastFetch.clear();
  }
}
