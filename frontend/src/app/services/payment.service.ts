import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/stripe`; // Adjust based on your API structure

  createCheckoutSession(plan: 'pro_monthly' | 'pro_yearly' | 'premium_monthly' | 'premium_yearly'): Observable<{ sessionId: string, url: string }> {
    const successUrl = `${window.location.origin}/dashboard?payment=success`;
    const cancelUrl = `${window.location.origin}/pricing?payment=canceled`;

    return this.http.post<{ sessionId: string, url: string }>(`${this.apiUrl}/create-checkout-session`, {
      plan,
      success_url: successUrl,
      cancel_url: cancelUrl
    });
  }

  createPortalSession(): Observable<{ url: string }> {
    const returnUrl = `${window.location.origin}/dashboard`;
    return this.http.post<{ url: string }>(`${this.apiUrl}/create-portal-session`, {
      return_url: returnUrl
    });
  }
}
