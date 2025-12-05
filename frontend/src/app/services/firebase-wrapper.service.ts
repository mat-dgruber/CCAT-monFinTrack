import { Injectable } from '@angular/core';
import {
     getAuth,
     createUserWithEmailAndPassword,
     signInWithEmailAndPassword,
     signOut,
     User,
     onAuthStateChanged,
     updateProfile,
     sendEmailVerification,
     sendPasswordResetEmail,
     Auth,
     UserCredential
} from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { environment } from '../../environments/environment';

@Injectable({
     providedIn: 'root'
})
export class FirebaseWrapperService {
     private app = initializeApp(environment.firebaseConfig);
     private auth: Auth = getAuth(this.app);

     getAuth(): Auth {
          return this.auth;
     }

     onAuthStateChanged(nextOrObserver: (user: User | null) => void): void {
          onAuthStateChanged(this.auth, nextOrObserver);
     }

     createUserWithEmailAndPassword(email: string, pass: string): Promise<UserCredential> {
          return createUserWithEmailAndPassword(this.auth, email, pass);
     }

     signInWithEmailAndPassword(email: string, pass: string): Promise<UserCredential> {
          return signInWithEmailAndPassword(this.auth, email, pass);
     }

     signOut(): Promise<void> {
          return signOut(this.auth);
     }

     updateProfile(user: User, profile: { displayName?: string; photoURL?: string }): Promise<void> {
          return updateProfile(user, profile);
     }

     sendEmailVerification(user: User, actionCodeSettings?: any): Promise<void> {
          return sendEmailVerification(user, actionCodeSettings);
     }

     sendPasswordResetEmail(email: string): Promise<void> {
          return sendPasswordResetEmail(this.auth, email);
     }

     deleteUser(user: User): Promise<void> {
          return user.delete();
     }
}
