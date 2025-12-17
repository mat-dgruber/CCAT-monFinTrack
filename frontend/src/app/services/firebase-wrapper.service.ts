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
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject, FirebaseStorage } from 'firebase/storage';
import { initializeApp } from 'firebase/app';
import { environment } from '../../environments/environment';

@Injectable({
     providedIn: 'root'
})
export class FirebaseWrapperService {
     private app = initializeApp(environment.firebaseConfig);
     private auth: Auth = getAuth(this.app);
     private storage: FirebaseStorage = getStorage(this.app);

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

     // --- Storage Methods ---

     async uploadFile(path: string, file: File): Promise<string> {
          const storageRef = ref(this.storage, path);
          try {
               const result = await uploadBytes(storageRef, file);
               return await getDownloadURL(result.ref);
          } catch (error) {
               console.error("Error uploading file:", error);
               throw error;
          }
     }

     async deleteFile(path: string): Promise<void> {
         // path can be the full URL or the storage path
         // If it's a URL, we need to extract the path or use refFromURL (not imported yet, simpler to assume path for now or handle both)
         // For simplicity, let's assume 'path' is the storage path (e.g. users/123/receipts/file.png)
         // OR, if we only have the URL, we can try to create a ref from it.

         // Let's implement a safe check: if it looks like a URL, use ref(storage, url) - wait, ref takes path.
         // Actually ref(storage, url) IS supported in newer SDKs for full URLs?
         // "ref(service, url)" -> Yes.

         const storageRef = ref(this.storage, path);
         return deleteObject(storageRef);
     }
}
