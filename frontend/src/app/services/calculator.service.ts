import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PresentValueRequest {
  parcel_value: number;
  monthly_interest_rate: number;
  due_date: string;
  payment_date?: string;
}

export interface AmortizationRequest {
  balance: number;
  rate_monthly: number;
  installment: number;
  extra_amount: number;
  system?: 'price' | 'sac';
}

@Injectable({
  providedIn: 'root',
})
export class CalculatorService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}`;

  // Basic Arithmetic (Client Side logic usually doesn't need a service, but we might want to store state here later)

  // Financial Calculations (Backend Integration)

  calculatePresentValue(request: PresentValueRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/calculator/present-value`, request);
  }

  simulateAmortization(request: AmortizationRequest): Observable<any> {
    const params = new HttpParams()
      .set('balance', request.balance.toString())
      .set('rate_monthly', request.rate_monthly.toString())
      .set('installment', request.installment.toString())
      .set('extra_amount', request.extra_amount.toString())
      .set('system', request.system || 'price');
    return this.http.get(`${this.apiUrl}/debts/simulation/amortization`, { params });
  }

  simulateMultipleParcels(
    rateMonthly: number,
    installment: number,
    count: number
  ): Observable<any> {
    const params = new HttpParams()
      .set('rate_monthly', rateMonthly.toString())
      .set('installment', installment.toString())
      .set('count', count.toString());
    return this.http.get(`${this.apiUrl}/debts/simulation/anticipate-multiple`, {
      params,
    });
  }

  simulateRevolving(
    balance: number,
    rateMonthly: number,
    minimumPct: number = 15,
    fixedPayment: number = 0
  ): Observable<any> {
    const params = new HttpParams()
      .set('balance', balance.toString())
      .set('rate_monthly', rateMonthly.toString())
      .set('minimum_pct', minimumPct.toString())
      .set('fixed_payment', fixedPayment.toString());
    return this.http.get(`${this.apiUrl}/debts/simulation/revolving`, { params });
  }
}
