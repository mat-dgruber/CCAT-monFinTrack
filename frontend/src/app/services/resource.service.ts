import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { SeasonalIncome, SeasonalIncomeCreate } from '../models/seasonal-income.model';

@Injectable({
  providedIn: 'root'
})
export class ResourceService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/resources`;

  getResources(): Observable<SeasonalIncome[]> {
    return this.http.get<SeasonalIncome[]>(this.apiUrl);
  }

  createResource(resource: SeasonalIncomeCreate): Observable<SeasonalIncome> {
    return this.http.post<SeasonalIncome>(this.apiUrl, resource);
  }

  updateResource(id: string, resource: Partial<SeasonalIncome>): Observable<SeasonalIncome> {
    return this.http.put<SeasonalIncome>(`${this.apiUrl}/${id}`, resource);
  }

  deleteResource(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
