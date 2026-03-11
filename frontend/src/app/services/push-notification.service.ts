import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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
  private messaging: any = null;
  private backendUrl = `${environment.apiUrl}/users/fcm-token`;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
  ) {
    // Inicializar Firebase (garantir que environment tenha config)
    const app = initializeApp(environment.firebaseConfig);
    isSupported().then((supported) => {
      if (supported) {
        this.messaging = getMessaging(app);
      } else {
        console.warn('⚠️ Firebase Messaging não é suportado neste navegador.');
      }
    });
  }

  async requestPermission() {
    if (!this.messaging) {
      console.warn(
        '⚠️ Tentativa de solicitar permissão FCM, mas o navegador não suporta.',
      );
      return;
    }
    try {
      console.log('🔔 Solicitando permissão para notificações...');
      const permission = await Notification.requestPermission();

      if (permission === 'granted') {
        console.log('✅ Permissão concedida.');
        const token = await getToken(this.messaging, {
          vapidKey: environment.firebaseVapidKey, // Necessário configurar no environment
        });

        if (token) {
          console.log('🎟️ Token FCM recebido:', token);
          this.sendTokenToBackend(token);
        } else {
          console.log('⚠️ Nenhum token de registro disponível.');
        }
      } else {
        console.log('❌ Permissão negada.');
      }
    } catch (error) {
      console.error('❌ Erro ao solicitar permissão:', error);
    }
  }

  private sendTokenToBackend(token: string) {
    this.http.post(this.backendUrl, { token }).subscribe({
      next: () => console.log('💾 Token salvo no backend.'),
      error: (err) => console.error('❌ Erro ao salvar token:', err),
    });
  }

  listen() {
    if (!this.messaging) return;
    onMessage(this.messaging, (payload) => {
      console.log('📨 Mensagem recebida no foreground:', payload);
      // Aqui você pode mostrar um Toast (PrimeNG) ou Snack bar customizado
      // alert(payload.notification?.title + ": " + payload.notification?.body);
    });
  }
}
