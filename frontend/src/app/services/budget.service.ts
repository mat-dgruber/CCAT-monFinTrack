import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Budget } from '../models/budget.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BudgetService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/budgets`;

  // GET (Lista com progresso calculado)
  getBudgets(month: number, year: number): Observable<Budget[]> {
    return this.http.get<Budget[]>(`${this.apiUrl}?month=${month}&year=${year}`);
  }

  // POST (Criar Meta)
  createBudget(budget: Budget): Observable<Budget> {
    return this.http.post<Budget>(this.apiUrl, budget);
  }

  updateBudget(id: string, budget: Budget): Observable<Budget> {
     return this.http.put<Budget>(`${this.apiUrl}/${id}`, budget);
   }

  // DELETE
  deleteBudget(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}