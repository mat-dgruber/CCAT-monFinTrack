import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export enum BCB_SERIES {
  TR = 226,
  SELIC_MONTHLY = 4390,
  SELIC_DAILY = 11,
  CDI_DAILY = 12,
  IPCA_MONTHLY = 433,
  IGPM_MONTHLY = 189,
  POUPANCA = 195,
}

export interface BCBResponse {
  data: string;
  valor: number;
}

import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class EconomicIndexService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/indicators`;

  /**
   * Gets the latest value for a given BCB series
   * @param serie Code of the series (BCB_SERIES)
   */
  getLatestValue(serie: BCB_SERIES): Observable<BCBResponse> {
    const url = `${this.apiUrl}/latest/${serie}`;
    return this.http.get<BCBResponse>(url);
  }

  /**
   * Gets values for a specific period
   */
  getValuesForPeriod(
    serie: BCB_SERIES,
    startDate: string,
    endDate: string,
  ): Observable<any[]> {
    const url = `${this.apiUrl}/period/${serie}?start_date=${startDate}&end_date=${endDate}`;
    return this.http.get<any[]>(url);
  }
}
