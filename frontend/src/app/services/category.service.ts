import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, ReplaySubject, map, tap } from 'rxjs';
import { Category } from '../models/category.model';

import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class CategoryService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/categories`;

  private categoriesCache$ = new ReplaySubject<Category[]>(1);
  private lastFetch = 0;
  private readonly CACHE_TIME = 600000; // 10 minutos em ms

  getCategories(type?: string, forceRefresh = false): Observable<Category[]> {
    const isExpired = Date.now() - this.lastFetch > this.CACHE_TIME;

    if (forceRefresh || isExpired) {
      return this.http.get<Category[]>(this.apiUrl).pipe(
        tap((cats) => {
          this.categoriesCache$.next(cats);
          this.lastFetch = Date.now();
        }),
        map((cats) => (type ? cats.filter((c) => c.type === type) : cats))
      );
    }

    return this.categoriesCache$
      .asObservable()
      .pipe(map((cats) => (type ? cats.filter((c) => c.type === type) : cats)));
  }

  createCategory(category: Category): Observable<Category> {
    return this.http.post<Category>(this.apiUrl, category).pipe(
      tap(() => this.clearCache())
    );
  }

  updateCategory(id: string, category: Category): Observable<Category> {
    return this.http.put<Category>(`${this.apiUrl}/${id}`, category).pipe(
      tap(() => this.clearCache())
    );
  }

  deleteCategory(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.clearCache())
    );
  }

  private clearCache() {
    this.lastFetch = 0;
  }
}
