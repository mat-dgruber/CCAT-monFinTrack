import { Component, inject } from '@angular/core';
import { DrawerModule } from 'primeng/drawer';
import { ButtonModule } from 'primeng/button';
import { RouterModule } from '@angular/router';
import { PwaService } from '../../../services/pwa.service';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.scss'],
  standalone: true,
  imports: [DrawerModule, ButtonModule, RouterModule]
})
export class Sidebar {
  sidebarVisible = false;
  pwaService = inject(PwaService);
}
