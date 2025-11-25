import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Category } from '../models/transaction.model'; // Reaproveitando a interface



import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class CategoryService {
  
  private http = inject(HttpClient);

  private apiUrl = `${environment.apiUrl}/categories`;

  getCategories(type?: string): Observable<Category[]> {
    let url = this.apiUrl;
    if (type) {
      url += `?type=${type}`;
    }
    return this.http.get<Category[]>(url);
  }

  createCategory(category: Category): Observable<Category> {
    return this.http.post<Category>(this.apiUrl, category);
  }

  updateCategory(id: string, category: Category): Observable<Category> {
      return this.http.put<Category>(`${this.apiUrl}/${id}`, category);
  }

  deleteCategory(id: string): Observable<void> {
      return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

}
