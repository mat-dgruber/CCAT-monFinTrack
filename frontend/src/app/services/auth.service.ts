import { Injectable, signal } from '@angular/core';
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
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private app = initializeApp(environment.firebaseConfig);
  private auth = getAuth(this.app);

  currentUser = signal<User | null>(null);

  constructor() {
    onAuthStateChanged(this.auth, (user) => {
      // SÓ aceita o usuário se o email estiver verificado!
      if (user && user.emailVerified) {
        this.currentUser.set(user);
      } else {
        this.currentUser.set(null);
      }
    });
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
    if (!credential.user.emailVerified) {
      await signOut(this.auth); // Chuta o usuário para fora
      throw new Error('email-not-verified'); // Lança erro específico
    }

    return credential;
  }

  async logout() {
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
