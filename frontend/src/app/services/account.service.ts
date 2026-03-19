import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, ReplaySubject, tap } from 'rxjs';
import { Account } from '../models/account.model';

import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AccountService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/accounts`;

  private accountsCache$ = new ReplaySubject<Account[]>(1);
  private lastFetch = 0;
  private readonly CACHE_TIME = 300000; // 5 minutos em ms

  getAccounts(forceRefresh = false): Observable<Account[]> {
    const isExpired = Date.now() - this.lastFetch > this.CACHE_TIME;

    if (forceRefresh || isExpired) {
      return this.http.get<Account[]>(this.apiUrl).pipe(
        tap((accs) => {
          this.accountsCache$.next(accs);
          this.lastFetch = Date.now();
        }),
      );
    }

    return this.accountsCache$.asObservable();
  }

  createAccount(account: Account): Observable<Account> {
    return this.http
      .post<Account>(this.apiUrl, account)
      .pipe(tap(() => this.clearCache()));
  }

  updateAccount(id: string, account: Account): Observable<Account> {
    return this.http
      .put<Account>(`${this.apiUrl}/${id}`, account)
      .pipe(tap(() => this.clearCache()));
  }

  deleteAccount(id: string): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/${id}`)
      .pipe(tap(() => this.clearCache()));
  }

  clearCache() {
    this.lastFetch = 0;
  }
}
