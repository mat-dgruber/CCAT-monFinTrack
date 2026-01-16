import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { UserPreferenceService } from './services/user-preference.service';
import { AuthService } from './services/auth.service'; // Added Import


import { PwaService } from './services/pwa.service';
import { ChatComponent } from './components/chat/chat.component';
import { PushNotificationService } from './services/push-notification.service';
import { Login } from './components/login/login';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ChatComponent,
    Login
  ],

  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  public authService = inject(AuthService); // Injected public for template access

  constructor(
      private userPrefs: UserPreferenceService,
      private pwaService: PwaService,
      private pushService: PushNotificationService
  ) {
      // Solicitar permissão de notificação ao iniciar
      this.pushService.requestPermission();
  }
}
