import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { filter, take } from 'rxjs';
import { initializeApp } from 'firebase/app';
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported,
} from 'firebase/messaging';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class PushNotificationService {
  private messagingReady: Promise<any>;
  private backendUrl = `${environment.apiUrl}/users/fcm-token`;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
  ) {
    const app = initializeApp(environment.firebaseConfig);
    this.messagingReady = isSupported().then((supported) =>
      supported ? getMessaging(app) : null,
    );
  }

  async requestPermission() {
    const messaging = await this.messagingReady;
    if (!messaging) return;

    try {
      const permission = await Notification.requestPermission();

      if (permission === 'granted') {
        const token = await getToken(messaging, {
          vapidKey: environment.firebaseVapidKey,
        });

        if (token) {
          this.sendTokenToBackend(token);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao solicitar permissão FCM:', error);
    }
  }

  private sendTokenToBackend(token: string) {
    // Wait for the user to be authenticated before sending — avoids 401 race condition
    this.authService.authState$
      .pipe(
        filter((user) => !!user),
        take(1),
      )
      .subscribe(() => {
        this.http.post(this.backendUrl, { token }).subscribe({
          error: (err) => console.error('❌ Erro ao salvar token FCM:', err),
        });
      });
  }

  listen() {
    this.messagingReady.then((messaging) => {
      if (!messaging) return;
      onMessage(messaging, (_payload) => {
        // foreground messages handled silently
      });
    });
  }
}
