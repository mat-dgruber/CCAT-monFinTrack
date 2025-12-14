import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface MonthlyAverageResponse {
  range: {
    start: string;
    end: string;
    months_count: number;
  };
  realized: {
    average_total: number;
    by_category: { [key: string]: number };
  };
  committed: {
    total: number;
  };
  total_estimated_monthly: number;
}

export interface InflationResponse {
  rate: number;
  is_fallback: boolean;
  message: string;
}

export interface Anomaly {
  category: string;
  current: number;
  average: number;
  pct_increase: number;
  severity: 'warning' | 'critical';
}

@Injectable({
  providedIn: 'root'
})
export class AnalysisService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/analysis`;

  getMonthlyAverages(startDate?: string, endDate?: string): Observable<MonthlyAverageResponse> {
    let params = new HttpParams();
    if (startDate) params = params.set('start_date', startDate);
    if (endDate) params = params.set('end_date', endDate);
    
    return this.http.get<MonthlyAverageResponse>(`${this.apiUrl}/monthly-averages`, { params });
  }

  getInflationRate(): Observable<InflationResponse> {
    return this.http.get<InflationResponse>(`${this.apiUrl}/inflation`);
  }

  getAnomalies(month?: number, year?: number): Observable<Anomaly[]> {
    let params = new HttpParams();
    if (month) params = params.set('month', month);
    if (year) params = params.set('year', year);

    return this.http.get<Anomaly[]>(`${this.apiUrl}/anomalies`, { params });
  }
}
