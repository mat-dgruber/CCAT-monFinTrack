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
            url: 'http://localhost:4200/verify-email', 
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

  logout() {
    return signOut(this.auth);
  }

  resetPassword(email: string) {
    return sendPasswordResetEmail(this.auth, email);
  }
}