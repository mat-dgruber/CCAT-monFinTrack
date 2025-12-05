import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-terms',
  templateUrl: './terms.html',
  styleUrls: ['./terms.scss'],
  standalone: true,
  imports: [CommonModule, ButtonModule, RouterModule],
})
export class Terms {
  constructor(private location: Location) { }

  goBack(): void {
    this.location.back();
  }
}
