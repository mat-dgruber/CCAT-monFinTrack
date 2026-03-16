import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { User, UserCredential } from 'firebase/auth';
import { from, switchMap, ReplaySubject, firstValueFrom, BehaviorSubject } from 'rxjs';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { environment } from '../../environments/environment';
import { FirebaseWrapperService } from './firebase-wrapper.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private firebaseWrapper = inject(FirebaseWrapperService);
  private router = inject(Router);
  private http = inject(HttpClient);

  currentUser = signal<User | null>(null);
  private _isAuthResolved = new BehaviorSubject<boolean>(false);
  isAuthResolved$ = this._isAuthResolved.asObservable();
  isAuthResolved = toSignal(this.isAuthResolved$, { initialValue: false });

  // Use ReplaySubject(1) to hold the latest auth state and emit immediately to new subscribers
  private authStateSubject = new ReplaySubject<User | null>(1);
  authState$ = this.authStateSubject.asObservable();

  constructor() {
    this.firebaseWrapper.onAuthStateChanged((user) => {
      // SÓ aceita o usuário se o email estiver verificado!
      if (user && user.emailVerified) {
        this.currentUser.set(user);
        this.authStateSubject.next(user);
        this.initializeUser(); // Garante categorias padrão agora COM token
      } else {
        this.currentUser.set(null);
        this.authStateSubject.next(null);
      }
      this._isAuthResolved.next(true);
    });

    // Safety timeout: se o Firebase não responder em 3s, marcamos como resolvido
    // Diminuído para 3s para falhar mais rápido e evitar o timeout do Interceptor (10s)
    setTimeout(() => {
      if (!this._isAuthResolved.value) {
        console.warn('AuthService: Auth resolution safety timeout reached.');
        this._isAuthResolved.next(true);
      }
    }, 3000);

    // Verifica a sessão periodicamente se houver duração configurada
    if (environment.sessionDuration > 0) {
      this.checkSession();
      // Verifica a cada 1 minuto
      setInterval(() => this.checkSession(), 60000);
    }
  }

  private checkSession() {
    const loginTimestamp = localStorage.getItem('loginTimestamp');
    if (loginTimestamp) {
      const elapsed = Date.now() - parseInt(loginTimestamp, 10);
      if (elapsed > environment.sessionDuration) {
        console.log('Sessão expirada. Fazendo logout...');
        this.logout();
        this.router.navigate(['/login']);
      }
    }
  }

  // 1. Cria a conta
  async register(email: string, pass: string, name: string) {
    const credential =
      await this.firebaseWrapper.createUserWithEmailAndPassword(email, pass);

    if (credential.user) {
      try {
        await this.firebaseWrapper.updateProfile(credential.user, {
          displayName: name,
        });

        // Chamada ao backend para enviar e-mail personalizado
        await firstValueFrom(
          this.http.post(`${environment.apiUrl}/auth/verify-email`, {
            email: credential.user.email,
          }),
        );

        await this.firebaseWrapper.signOut();
      } catch (error: any) {
        // Se falhar o backend, deletamos o usuário no firebase para permitir retry
        const errorMsg = error.error?.detail || error.message || 'Erro desconhecido';
        console.error(`Falha no processo de registro (backend): ${errorMsg}. Removendo usuário do Firebase para permitir nova tentativa...`);
        try {
          await this.firebaseWrapper.deleteUser(credential.user);
        } catch (deleteError) {
          console.error('Erro ao remover usuário órfão do Firebase:', deleteError);
        }
        throw error;
      }
    }
    return credential;
  }

  async login(email: string, pass: string) {
    const credential = await this.firebaseWrapper.signInWithEmailAndPassword(
      email,
      pass,
    );

    // 5. Verificação de Segurança no Login: Impedir acesso se e-mail não estiver verificado
    if (!credential.user.emailVerified) {
      await this.firebaseWrapper.signOut();
      throw new Error('E-mail não verificado. Verifique sua caixa de entrada antes de acessar o sistema.');
    }
    
    return credential;
  }

  async logout() {
    localStorage.removeItem('loginTimestamp');
    await this.firebaseWrapper.signOut();
    this.router.navigate(['/login']);
  }

  async resetPassword(email: string) {
    return await firstValueFrom(
      this.http.post(`${environment.apiUrl}/auth/reset-password`, { email }),
    );
  }


  async deleteAccount() {
    const user = this.firebaseWrapper.getAuth().currentUser;
    if (user) {
      return await this.firebaseWrapper.deleteUser(user);
    }
    throw new Error('No user logged in');
  }

  async updateProfileData(displayName?: string, photoURL?: string) {
    const user = this.firebaseWrapper.getAuth().currentUser;
    if (!user) throw new Error('No user logged in');

    return await this.firebaseWrapper.updateProfile(user, {
      displayName: displayName || user.displayName || undefined,
      photoURL: photoURL || user.photoURL || undefined,
    });
  }

  async sendVerificationEmail() {
    const user = this.firebaseWrapper.getAuth().currentUser;
    if (!user) throw new Error('No user logged in');

    return await firstValueFrom(
      this.http.post(`${environment.apiUrl}/auth/verify-email`, {
        email: user.email,
      }),
    );
  }

  private initializeUser() {
    // Esse POST garante que o registro no DB exista (categorias padrão, etc)
    this.http.post(`${environment.apiUrl}/users/setup`, {}).subscribe({
      next: () => {
        console.log('User setup completed');
        // NOTA: O UserPreferenceService já está ouvindo o authState$
        // e fará o fetchPreferences() automaticamente.
      },
      error: (err) => console.error('Error setting up user', err),
    });
  }
}
