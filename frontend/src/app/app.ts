import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { UserPreferenceService } from './services/user-preference.service';



import { PwaService } from './services/pwa.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule
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
