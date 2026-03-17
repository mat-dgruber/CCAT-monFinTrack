import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ChildrenOutletContexts } from '@angular/router';
import { ToastModule } from 'primeng/toast';

import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { TooltipModule } from 'primeng/tooltip';

// Componentes
// Componentes

import { AuthService } from '../../services/auth.service';
import { UserPreferenceService } from '../../services/user-preference.service';
import { PwaService } from '../../services/pwa.service';
import { SubscriptionService } from '../../services/subscription.service';
import { CalculatorComponent } from '../shared/calculator/calculator.component';
import { routeTransitionAnimations } from '../../route-animations';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    ToastModule,
    TooltipModule,
    RouterModule,
    ButtonModule,
    DrawerModule,
    CalculatorComponent,
  ],
  templateUrl: './home.html',
  animations: [routeTransitionAnimations],
})
export class Home {
  authService = inject(AuthService);
  userPreferenceService = inject(UserPreferenceService);
  pwaService = inject(PwaService);
  subscriptionService = inject(SubscriptionService);
  private contexts = inject(ChildrenOutletContexts);

  sidebarVisible = signal(false);
  sidebarCollapsed = signal(localStorage.getItem('sidebarCollapsed') === 'true');
  calculatorVisible = signal(false);
  moreMenuVisible = signal(false);
  currentYear = new Date().getFullYear();

  firstName = computed(() => {
    const user = this.authService.currentUser();
    return user?.displayName?.split(' ')[0] || 'Usuário';
  });

  logout() {
    this.authService.logout();
  }

  toggleSidebar() {
    this.sidebarVisible.update((v) => !v);
  }

  toggleSidebarCollapse() {
    this.sidebarCollapsed.update((v) => {
      const newVal = !v;
      localStorage.setItem('sidebarCollapsed', String(newVal));
      return newVal;
    });
  }

  closeSidebar() {
    this.sidebarVisible.set(false);
  }

  toggleCalculator() {
    this.calculatorVisible.update((v) => !v);
    this.closeSidebar();
  }

  toggleMoreMenu() {
    this.moreMenuVisible.update((v) => !v);
  }

  getRouteAnimationData() {
    return (
      this.contexts.getContext('primary')?.route?.snapshot?.data?.[
        'animation'
      ] || this.contexts.getContext('primary')?.route?.snapshot?.url?.[0]?.path
    );
  }
}
