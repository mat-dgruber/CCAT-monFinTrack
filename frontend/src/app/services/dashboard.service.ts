import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { Budget } from '../models/budget.model';

export interface CategoryTotal {
  category_name: string;
  color: string;
  total: number;
}

export interface PaymentMethodTotal {
  payment_method_name: string;
  total: number;
}

export interface AccountTotal {
  account_name: string;
  total: number;
}

export interface DashboardSummary {
  total_balance: number;
  income_month: number;
  expense_month: number;
  expenses_by_category: CategoryTotal[];
  budgets: Budget[];
  expenses_by_payment_method?: PaymentMethodTotal[];
  expenses_by_account?: AccountTotal[];
}


import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
 
  private http = inject(HttpClient);

  private apiUrl = `${environment.apiUrl}/dashboard`;

  getSummary(month: number, year: number, filters?: { [key: string]: any }): Observable<DashboardSummary> {
    let params = new HttpParams()
      .set('month', month.toString())
      .set('year', year.toString());

    if (filters) {
      Object.keys(filters).forEach(key => {
        if (filters[key]) {
          params = params.set(key, filters[key]);
        }
      });
    }

    return this.http.get<DashboardSummary>(this.apiUrl, { params });
  }

}
