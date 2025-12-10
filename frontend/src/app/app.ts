import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { UserPreferenceService } from './services/user-preference.service';


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
  constructor(private userPrefs: UserPreferenceService) {}
}
