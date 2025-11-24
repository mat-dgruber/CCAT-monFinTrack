import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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
}


@Injectable({
  providedIn: 'root',
})
export class DashboardService {
 
  private http = inject(HttpClient);

  private apiUrl = 'http://127.0.0.1:8000/api/dashboard';

  getSummary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(this.apiUrl);
  }

}
