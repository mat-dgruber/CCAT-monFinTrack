import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Debt, PaymentPlan, AmortizationSystem } from '../models/debt.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class DebtService {
  private apiUrl = `${environment.apiUrl}/debts`;

  constructor(private http: HttpClient) {}

  // --- CRUD ---

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

  // --- PLANNER ---

  generatePlan(
    strategy: 'snowball' | 'avalanche',
    monthlyBudget: number,
  ): Observable<PaymentPlan> {
    const params = new HttpParams()
      .set('strategy', strategy)
      .set('monthly_budget', monthlyBudget.toString());
    return this.http.post<PaymentPlan>(`${this.apiUrl}/plan`, {}, { params });
  }

  // --- HOUSING SIMULATOR ---

  getHousingDefaults(income: number): Observable<any> {
    const params = new HttpParams().set('income', income.toString());
    return this.http.get(`${this.apiUrl}/defaults/housing`, { params });
  }

  simulateHousing(
    propertyValue: number,
    entryValue: number,
    rate: number,
    months: number,
    system: AmortizationSystem,
  ): Observable<any> {
    const params = new HttpParams()
      .set('property_value', propertyValue.toString())
      .set('entry_value', entryValue.toString())
      .set('interest_rate_yearly', rate.toString())
      .set('months', months.toString())
      .set('system', system);
    return this.http.post(`${this.apiUrl}/simulation/housing`, {}, { params });
  }

  // --- AI FEATURES ---

  analyzeDocument(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.apiUrl}/analyze`, formData);
  }

  getAdvice(monthlySurplus: number): Observable<any> {
    const params = new HttpParams().set(
      'monthly_surplus',
      monthlySurplus.toString(),
    );
    return this.http.post(`${this.apiUrl}/advice`, {}, { params });
  }

  // --- CALCULATOR ---

  simulateAmortization(
    balance: number,
    rateMonthly: number,
    installment: number,
    extraAmount: number,
    system: string = 'price',
  ): Observable<any> {
    const params = new HttpParams()
      .set('balance', balance.toString())
      .set('rate_monthly', rateMonthly.toString())
      .set('installment', installment.toString())
      .set('extra_amount', extraAmount.toString())
      .set('system', system);
    return this.http.get(`${this.apiUrl}/simulation/amortization`, { params });
  }

  simulateMultipleParcels(
    rateMonthly: number,
    installment: number,
    count: number,
  ): Observable<any> {
    const params = new HttpParams()
      .set('rate_monthly', rateMonthly.toString())
      .set('installment', installment.toString())
      .set('count', count.toString());
    return this.http.get(`${this.apiUrl}/simulation/anticipate-multiple`, {
      params,
    });
  }

  /**
   * Simula o estrago do cartão rotativo ou cheque especial.
   * Projeção pagando mínimo vs valor fixo.
   */
  simulateRevolving(
    balance: number,
    rateMonthly: number, // em %, ex: 15.5
    minimumPct: number = 15, // em %, ex: 15
    fixedPayment: number = 0,
  ): Observable<any> {
    const params = new HttpParams()
      .set('balance', balance.toString())
      .set('rate_monthly', rateMonthly.toString())
      .set('minimum_pct', minimumPct.toString())
      .set('fixed_payment', fixedPayment.toString());
    return this.http.get(`${this.apiUrl}/simulation/revolving`, { params });
  }

  /**
   * Busca alertas específicos de uma dívida (IPVA, seguro, subsídio, gravame...).
   */
  getDebtAlerts(debtId: string): Observable<DebtAlert[]> {
    return this.http.get<DebtAlert[]>(`${this.apiUrl}/alerts/${debtId}`);
  }

  calculatePresentValue(
    parcelValue: number,
    monthlyRate: number,
    dueDate: string,
    paymentDate?: string,
  ): Observable<any> {
    const payload = {
      parcel_value: parcelValue,
      monthly_interest_rate: monthlyRate,
      due_date: dueDate,
      payment_date: paymentDate,
    };
    return this.http.post(
      `${environment.apiUrl}/calculator/present-value`,
      payload,
    );
  }
}

// --- TIPOS DE SUPORTE ---

export interface DebtAlert {
  type: 'error' | 'warning' | 'info';
  code: string;
  title: string;
  message: string;
  priority: number;
}
