import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { Budget } from '../models/budget.model';

export interface CategoryTotal{
  category_name: string;
  color: string;
  total: number;
}

export interface DashboardSummary {
  total_balance: number;
  income_month: number;
  expense_month: number;
  expenses_by_category: CategoryTotal[];
  budgets: Budget[];
}


import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
 
  private http = inject(HttpClient);

  private apiUrl = `${environment.apiUrl}/dashboard`;

  getSummary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(this.apiUrl);
  }

}
