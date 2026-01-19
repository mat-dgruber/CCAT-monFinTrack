import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AIService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/ai`;

  classifyTransaction(description: string): Observable<{ category_id: string | null }> {
    return this.http.post<{ category_id: string | null }>(`${this.apiUrl}/classify`, { description });
  }

  sendMessage(message: string, persona: string = 'friendly'): Observable<{ response: string }> {
    return this.http.post<{ response: string }>(`${this.apiUrl}/chat`, { message, persona });
  }

  scanReceipt(file: File): Observable<{
    title: string,
    amount: number,
    date: string,
    category_id: string,
    items: { description: string, amount: number, category_id: string }[],
    location: string,
    payment_method: string,
    account_id: string,
    description?: string,
    attachment_url?: string
  }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{
      title: string,
      amount: number,
      date: string,
      category_id: string,
      items: { description: string, amount: number, category_id: string }[],
      location: string,
      payment_method: string,
      account_id: string,
      description?: string,
      attachment_url?: string
    }>(`${this.apiUrl}/scan`, formData);
  }

  scanReceiptFromUrl(url: string): Observable<{
    title: string,
    amount: number,
    date: string,
    category_id: string,
    items: { description: string, amount: number, category_id: string }[],
    location: string,
    payment_method: string,
    account_id: string,
    description?: string,
    attachment_url?: string
  }> {
    // We send as a query param or form data? The backend expects multipart/form-data with 'file' or 'file_url'
    // But 'file_url' is a string. We can send as query param?
    // My backend implementation:
    // async def scan_receipt_endpoint(file: Optional[UploadFile] = File(None), file_url: Optional[str] = None, ...):
    // FastAPI handles 'file_url' as a query param by default if not specified as Form(...) or Body(...).
    // Let's check my backend code again.
    // I defined: file_url: Optional[str] = None.
    // If I didn't use Form(), it defaults to Query param.
    // Let's assume query param for simplicity.
    return this.http.post<{
        title: string,
        amount: number,
        date: string,
        category_id: string,
        items: { description: string, amount: number, category_id: string }[],
        location: string,
        payment_method: string,
        account_id: string,
        description?: string,
        attachment_url?: string
      }>(`${this.apiUrl}/scan`, null, { params: { file_url: url } });
  }

  getSubscriptionSuggestions(): Observable<any[]> {
    // Note: Analysis router is mounted at /api/analysis, not /api/ai
    // So we need to construct the URL manually or adjust base
    const analysisUrl = `${environment.apiUrl}/analysis/subscriptions`;
    return this.http.get<any[]>(analysisUrl);
  }

  generateMonthlyReport(month: number, year: number): Observable<{ content: string }> {
    return this.http.get<{ content: string }>(`${this.apiUrl}/report`, { params: { month, year } });
  }

  analyzeCostOfLiving(data: any): Observable<{ analysis: string }> {
    // Touching file to force recompile
    return this.http.post<{ analysis: string }>(`${this.apiUrl}/cost-of-living-analysis`, { data });
  }

  getLimits(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/limits`);
  }
}
