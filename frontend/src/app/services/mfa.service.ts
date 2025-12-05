import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

export interface MFASetupResponse {
     secret: string;
     qr_code: string;
}

export interface MFAStatusResponse {
     enabled: boolean;
}

@Injectable({
     providedIn: 'root'
})
export class MFAService {
     private http = inject(HttpClient);
     private apiUrl = `${environment.apiUrl}/mfa`;

     setupMFA(): Observable<MFASetupResponse> {
          return this.http.post<MFASetupResponse>(`${this.apiUrl}/setup`, {});
     }

     enableMFA(secret: string, token: string): Observable<any> {
          return this.http.post(`${this.apiUrl}/enable`, { secret, token });
     }

     disableMFA(): Observable<any> {
          return this.http.post(`${this.apiUrl}/disable`, {});
     }

     checkMFAStatus(): Observable<MFAStatusResponse> {
          return this.http.get<MFAStatusResponse>(`${this.apiUrl}/status`);
     }

     verifyLogin(token: string): Observable<any> {
          return this.http.post(`${this.apiUrl}/verify`, { token });
     }
}
