import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-privacy-policy',
  templateUrl: './privacy-policy.html',
  styleUrls: ['./privacy-policy.scss'],
  standalone: true,
  imports: [CommonModule, ButtonModule, RouterModule],
})
export class PrivacyPolicy {
  constructor(private location: Location) { }

  goBack(): void {
    this.location.back();
  }
}
