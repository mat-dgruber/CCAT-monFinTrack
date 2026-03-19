import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, ReplaySubject, tap } from 'rxjs';

import { Budget } from '../models/budget.model';

export interface CategoryTotal {
  category_name: string;
  color: string;
  total: number;
}

export interface MonthlyEvolution {
  month: string;
  income: number;
  expense: number;
}

export interface DashboardSummary {
  total_balance: number;
  income_month: number;
  expense_month: number;
  expenses_by_category: CategoryTotal[];
  budgets: Budget[];
  evolution: MonthlyEvolution[];
}

import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/dashboard`;

  private dashboardCache = new Map<string, ReplaySubject<DashboardSummary>>();
  private lastFetch = new Map<string, number>();
  private readonly CACHE_TIME = 60000; // 1 minuto

  getSummary(
    month: number,
    year: number,
    filters?: any,
    forceRefresh = false
  ): Observable<DashboardSummary> {
    let params = new HttpParams()
      .set('month', month.toString())
      .set('year', year.toString());

    if (filters) {
      if (filters.accounts && filters.accounts.length > 0) {
        filters.accounts.forEach((acc: any) => {
          params = params.append('accounts', acc.id);
        });
      }
      if (filters.paymentMethods && filters.paymentMethods.length > 0) {
        filters.paymentMethods.forEach((pm: any) => {
          params = params.append('payment_methods', pm.value);
        });
      }
      if (filters.dateRange && filters.dateRange[0]) {
        params = params.append(
          'start_date',
          new Date(filters.dateRange[0]).toISOString(),
        );
        if (filters.dateRange[1]) {
          params = params.append(
            'end_date',
            new Date(filters.dateRange[1]).toISOString(),
          );
        }
      }
    }

    const key = params.toString();
    const isExpired = Date.now() - (this.lastFetch.get(key) || 0) > this.CACHE_TIME;

    if (forceRefresh || isExpired || !this.dashboardCache.has(key)) {
      if (!this.dashboardCache.has(key)) {
        this.dashboardCache.set(key, new ReplaySubject<DashboardSummary>(1));
      }

      return this.http.get<DashboardSummary>(this.apiUrl, { params }).pipe(
        tap((data) => {
          this.dashboardCache.get(key)?.next(data);
          this.lastFetch.set(key, Date.now());
        })
      );
    }

    return this.dashboardCache.get(key)!.asObservable();
  }

  clearCache() {
    this.dashboardCache.clear();
    this.lastFetch.clear();
  }
}
