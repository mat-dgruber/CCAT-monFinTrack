import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Debt, PaymentPlan, AmortizationSystem } from '../models/debt.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DebtService {
  private apiUrl = `${environment.apiUrl}/debts`;

  constructor(private http: HttpClient) {}

  getDebts(): Observable<Debt[]> {
    return this.http.get<Debt[]>(this.apiUrl);
  }

  createDebt(debt: Partial<Debt>): Observable<Debt> {
    return this.http.post<Debt>(this.apiUrl, debt);
  }

  updateDebt(id: string, debt: Partial<Debt>): Observable<Debt> {
    return this.http.put<Debt>(`${this.apiUrl}/${id}`, debt);
  }

  deleteDebt(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  generatePlan(strategy: 'snowball' | 'avalanche', monthlyBudget: number): Observable<PaymentPlan> {
    const params = new HttpParams()
      .set('strategy', strategy)
      .set('monthly_budget', monthlyBudget.toString());

    return this.http.post<PaymentPlan>(`${this.apiUrl}/plan`, {}, { params });
  }

  getHousingDefaults(income: number): Observable<any> {
    const params = new HttpParams().set('income', income.toString());
    return this.http.get(`${this.apiUrl}/defaults/housing`, { params });
  }

  simulateHousing(
    propertyValue: number,
    entryValue: number,
    rate: number,
    months: number,
    system: AmortizationSystem
  ): Observable<any> {
    const params = new HttpParams()
      .set('property_value', propertyValue.toString())
      .set('entry_value', entryValue.toString())
      .set('interest_rate_yearly', rate.toString())
      .set('months', months.toString())
      .set('system', system);

    return this.http.post(`${this.apiUrl}/simulation/housing`, {}, { params });
  }

  analyzeDocument(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.apiUrl}/analyze`, formData);
  }

  getAdvice(monthlySurplus: number): Observable<any> {
    const params = new HttpParams().set('monthly_surplus', monthlySurplus.toString());
    return this.http.post(`${this.apiUrl}/advice`, {}, { params });
  }
}
