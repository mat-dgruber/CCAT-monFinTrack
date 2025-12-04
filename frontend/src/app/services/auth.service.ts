import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  User,
  onAuthStateChanged,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail
} from 'firebase/auth';
import { from, switchMap, ReplaySubject } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private app = initializeApp(environment.firebaseConfig);
  private auth = getAuth(this.app);
  private router = inject(Router);

  currentUser = signal<User | null>(null);

  // Use ReplaySubject(1) to hold the latest auth state and emit immediately to new subscribers
  private authStateSubject = new ReplaySubject<User | null>(1);
  authState$ = this.authStateSubject.asObservable();

  constructor() {
    onAuthStateChanged(this.auth, (user) => {
      // SÓ aceita o usuário se o email estiver verificado!
      if (user && user.emailVerified) {
        this.currentUser.set(user);
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
    const credential = await createUserWithEmailAndPassword(this.auth, email, pass);

    if (credential.user) {
      await updateProfile(credential.user, { displayName: name });

      // CONFIGURAÇÃO DO LINK MÁGICO
      const actionCodeSettings = {
        // Para onde o usuário vai após clicar? (Mude para seu domínio real em produção)
        url: `${environment.appUrl}/verify-email`,
        handleCodeInApp: true
      };

      // Passamos as configurações aqui
      await sendEmailVerification(credential.user, actionCodeSettings);

      await signOut(this.auth);
    }
    return credential;
  }

  async login(email: string, pass: string) {
    const credential = await signInWithEmailAndPassword(this.auth, email, pass);

    // 5. Verificação de Segurança no Login
    return credential;
  }

  async logout() {
    localStorage.removeItem('loginTimestamp');
    return await signOut(this.auth);
  }

  async resetPassword(email: string) {
    return await sendPasswordResetEmail(this.auth, email);
  }

  async deleteAccount() {
    const user = this.auth.currentUser;
    if (user) {
      return await user.delete();
    }
    throw new Error('No user logged in');
  }

  async updateProfileData(displayName?: string, photoURL?: string) {
    const user = this.auth.currentUser;
    if (!user) throw new Error('No user logged in');

    return await updateProfile(user, {
      displayName: displayName || user.displayName,
      photoURL: photoURL || user.photoURL
    });
  }

  async sendVerificationEmail() {
    const user = this.auth.currentUser;
    if (!user) throw new Error('No user logged in');

    const actionCodeSettings = {
      url: `${environment.appUrl}/verify-email`,
      handleCodeInApp: true
    };
    return await sendEmailVerification(user, actionCodeSettings);
  }
}
