import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { User, UserCredential } from 'firebase/auth';
import { from, switchMap, ReplaySubject } from 'rxjs';
import { environment } from '../../environments/environment';
import { FirebaseWrapperService } from './firebase-wrapper.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private firebaseWrapper = inject(FirebaseWrapperService);
  private router = inject(Router);
  private http = inject(HttpClient);

  currentUser = signal<User | null>(null);

  // Use ReplaySubject(1) to hold the latest auth state and emit immediately to new subscribers
  private authStateSubject = new ReplaySubject<User | null>(1);
  authState$ = this.authStateSubject.asObservable();

  constructor() {
    this.firebaseWrapper.onAuthStateChanged((user) => {
      // SÓ aceita o usuário se o email estiver verificado!
      if (user && user.emailVerified) {
        this.currentUser.set(user);
        this.initializeUser(); // Garante categorias padrão
        this.authStateSubject.next(user);
      } else {
        this.currentUser.set(null);
        this.authStateSubject.next(null);
      }
    });

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
    const credential = await this.firebaseWrapper.createUserWithEmailAndPassword(email, pass);

    if (credential.user) {
      await this.firebaseWrapper.updateProfile(credential.user, { displayName: name });

      // CONFIGURAÇÃO DO LINK MÁGICO
      const actionCodeSettings = {
        // Para onde o usuário vai após clicar? (Mude para seu domínio real em produção)
        url: `${environment.appUrl}/verify-email`,
        handleCodeInApp: true
      };

      // Passamos as configurações aqui
      await this.firebaseWrapper.sendEmailVerification(credential.user, actionCodeSettings);

      await this.firebaseWrapper.signOut();
    }
    return credential;
  }

  async login(email: string, pass: string) {
    const credential = await this.firebaseWrapper.signInWithEmailAndPassword(email, pass);

    // 5. Verificação de Segurança no Login
    return credential;
  }

  async logout() {
    localStorage.removeItem('loginTimestamp');
    await this.firebaseWrapper.signOut();
    this.router.navigate(['/login']);
  }

  async resetPassword(email: string) {
    return await this.firebaseWrapper.sendPasswordResetEmail(email);
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
      photoURL: photoURL || user.photoURL || undefined
    });
  }

  async sendVerificationEmail() {
    const user = this.firebaseWrapper.getAuth().currentUser;
    if (!user) throw new Error('No user logged in');

    const actionCodeSettings = {
      url: `${environment.appUrl}/verify-email`,
      handleCodeInApp: true
    };
    return await this.firebaseWrapper.sendEmailVerification(user, actionCodeSettings);
  }

  private initializeUser() {
    this.http.post(`${environment.apiUrl}/users/setup`, {}).subscribe({
      next: () => console.log('User setup completed'),
      error: (err) => console.error('Error setting up user', err)
    });
  }
}
