import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { InvoiceSummary, PayInvoicePayload } from '../models/invoice.model';

@Injectable({
  providedIn: 'root'
})
export class InvoiceService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/invoices`;

  getInvoices(): Observable<InvoiceSummary[]> {
    return this.http.get<InvoiceSummary[]>(this.apiUrl);
  }

  payInvoice(payload: PayInvoicePayload): Observable<any> {
    return this.http.post(`${this.apiUrl}/pay`, payload);
  }
}
