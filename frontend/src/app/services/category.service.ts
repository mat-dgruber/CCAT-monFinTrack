import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Category } from '../models/transaction.model'; // Reaproveitando a interface


@Injectable({
  providedIn: 'root',
})
export class CategoryService {
  
  private http = inject(HttpClient);

  private apiUrl = 'http://127.0.0.1:8000/api/categories';

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(this.apiUrl);
  }

}
