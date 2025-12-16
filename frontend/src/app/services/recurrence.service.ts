import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Recurrence } from '../models/recurrence.model';

@Injectable({
  providedIn: 'root'
})
export class RecurrenceService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/recurrences`;

  getRecurrences(activeOnly: boolean = false): Observable<Recurrence[]> {
    let params = new HttpParams();
    if (activeOnly) {
      params = params.set('active_only', 'true');
    }
    return this.http.get<Recurrence[]>(this.apiUrl, { params });
  }

  createRecurrence(recurrence: Recurrence): Observable<Recurrence> {
    return this.http.post<Recurrence>(this.apiUrl, recurrence);
  }

  updateRecurrence(id: string, recurrence: Partial<Recurrence>, scope: 'all' | 'future' = 'all'): Observable<Recurrence> {
    let params = new HttpParams().set('scope', scope);
    return this.http.put<Recurrence>(`${this.apiUrl}/${id}`, recurrence, { params });
  }

  cancelRecurrence(id: string): Observable<Recurrence> {
    return this.http.patch<Recurrence>(`${this.apiUrl}/${id}/cancel`, {});
  }

  skipRecurrence(id: string, date: Date): Observable<Recurrence> {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    return this.http.post<Recurrence>(`${this.apiUrl}/${id}/skip`, { date: dateString });
  }
}
