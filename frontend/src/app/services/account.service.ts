import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Account } from '../models/account.model';

@Injectable({
  providedIn: 'root',
})
export class AccountService {

  private http = inject(HttpClient);

  private apiUrl = 'http://127.0.0.1:8000/api/accounts';

  getAccounts(): Observable<Account[]> {
    return this.http.get<Account[]>(this.apiUrl);
  }

  createAccount(account: Account): Observable<Account> {
    return this.http.post<Account>(this.apiUrl, account);
  }
  
  updateAccount(id: string, account: Account): Observable<Account> {
    return this.http.put<Account>(`${this.apiUrl}/${id}`, account);
}

  deleteAccount(id: string): Observable<void> {
   return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
