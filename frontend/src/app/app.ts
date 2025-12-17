import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { UserPreferenceService } from './services/user-preference.service';



import { PwaService } from './services/pwa.service';
import { ChatComponent } from './components/chat/chat.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ChatComponent
  ],

  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  constructor(
      private userPrefs: UserPreferenceService,
      private pwaService: PwaService // Inicializa o serviço PWA
  ) {}
}
