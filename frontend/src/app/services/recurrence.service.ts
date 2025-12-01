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

  updateRecurrence(id: string, recurrence: Partial<Recurrence>): Observable<Recurrence> {
    return this.http.put<Recurrence>(`${this.apiUrl}/${id}`, recurrence);
  }

  cancelRecurrence(id: string): Observable<Recurrence> {
    return this.http.patch<Recurrence>(`${this.apiUrl}/${id}/cancel`, {});
  }
}
