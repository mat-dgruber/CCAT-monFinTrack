import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MonthSelector } from './components/month-selector/month-selector';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    CommonModule,
    RouterModule,
    MonthSelector
  ],

  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {}