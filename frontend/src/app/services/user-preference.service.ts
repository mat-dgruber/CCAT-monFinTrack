import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, tap, catchError } from 'rxjs';
import { UserPreference, UserPreferenceCreate } from '../models/user-preference.model';
import { environment } from '../../environments/environment';

@Injectable({
     providedIn: 'root'
})
export class UserPreferenceService {
     private apiUrl = `${environment.apiUrl}/preferences`;
     private preferencesSubject = new BehaviorSubject<UserPreference | null>(null);
     preferences$ = this.preferencesSubject.asObservable();

     private readonly STORAGE_KEY = 'user_preferences';

     private mediaQueryListener: () => void;

     constructor(private http: HttpClient) {
          // Initialize listener for system theme changes
          this.mediaQueryListener = () => {
               const currentPrefs = this.preferencesSubject.value;
               if (currentPrefs && currentPrefs.theme === 'system') {
                    this.applyTheme('system');
               }
          };
          window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', this.mediaQueryListener);

          this.loadInitialPreferences();
     }

     private loadInitialPreferences() {
          // 1. Load from LocalStorage (Instant)
          const stored = localStorage.getItem(this.STORAGE_KEY);
          if (stored) {
               try {
                    const parsed = JSON.parse(stored);
                    this.preferencesSubject.next(parsed);
                    this.applyTheme(parsed.theme || 'light');
               } catch (e) {
                    console.error('Failed to parse stored preferences', e);
               }
          }

          // 2. Fetch from API (Background update)
          this.fetchPreferences().subscribe();
     }

     fetchPreferences(): Observable<UserPreference> {
          return this.http.get<UserPreference>(this.apiUrl).pipe(
               tap(prefs => {
                    const current = this.preferencesSubject.value;
                    // Update if remote version is newer or no local data
                    if (!current || prefs.version > current.version) {
                         this.updateLocalState(prefs);
                    }
               }),
               catchError(err => {
                    console.error('Failed to fetch preferences', err);
                    return of(this.preferencesSubject.value as UserPreference);
               })
          );
     }

     updatePreferences(data: UserPreferenceCreate): Observable<UserPreference> {
          // Optimistic Update
          const current = this.preferencesSubject.value;
          if (current) {
               const optimistic = { ...current, ...data, version: current.version + 1 };
               this.updateLocalState(optimistic);
          }

          return this.http.put<UserPreference>(this.apiUrl, data).pipe(
               tap(prefs => {
                    // Confirm update with server response
                    this.updateLocalState(prefs);
               }),
               catchError(err => {
                    console.error('Failed to update preferences', err);
                    // Revert if needed? For now, we keep optimistic or reload
                    // Ideally, revert to 'current'
                    if (current) this.updateLocalState(current);
                    throw err;
               })
          );
     }

     uploadAvatar(file: File): Observable<{ url: string }> {
          const formData = new FormData();
          formData.append('file', file);

          return this.http.post<{ url: string }>(`${this.apiUrl}/avatar`, formData).pipe(
               tap(response => {
                    const current = this.preferencesSubject.value;
                    if (current) {
                         this.updateLocalState({ ...current, profile_image_url: response.url });
                    }
               })
          );
     }

     resetAccount(): Observable<any> {
          return this.http.post(`${this.apiUrl}/reset`, {});
     }

     getProfileImageUrl(path: string | undefined | null): string {
          if (!path) return 'assets/default-avatar.png';
          if (path.startsWith('http')) return path;

          // Construct absolute URL from environment.apiUrl
          // environment.apiUrl is like 'http://localhost:8000/api'
          // We need 'http://localhost:8000' + path (which is like '/static/...')
          const baseUrl = environment.apiUrl.replace('/api', '');
          return `${baseUrl}${path}`;
     }

     private updateLocalState(prefs: UserPreference) {
          this.preferencesSubject.next(prefs);
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(prefs));
          this.applyTheme(prefs.theme || 'light');
     }

     private applyTheme(theme: string) {
          let effectiveTheme = theme;

          if (theme === 'system') {
               const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
               effectiveTheme = systemDark ? 'dark' : 'light';
          }

          if (effectiveTheme === 'dark') {
               document.documentElement.classList.add('dark'); // Tailwind
               document.body.classList.add('dark-theme'); // Custom/PrimeNG
          } else {
               document.documentElement.classList.remove('dark');
               document.body.classList.remove('dark-theme');
          }
     }
}
