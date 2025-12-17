import { Injectable, computed, inject, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { UserPreferenceService } from './user-preference.service';
import { UserPreference } from '../models/user-preference.model';

export type Feature = 'monthly_report' | 'roast_mode' | 'subscription_hunter' | 'recurring_dashboard';

@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {
  private preferenceService = inject(UserPreferenceService);
  
  // Convert observable to signal
  private prefs: Signal<UserPreference | null | undefined> = toSignal(this.preferenceService.preferences$);

  // Computed signal for current tier
  currentTier = computed(() => {
    return this.prefs()?.subscription_tier || 'free';
  });

  canAccess(feature: Feature): boolean {
    const tier = this.currentTier();
    
    switch (feature) {
      case 'recurring_dashboard':
        return true; // Everyone
        
      case 'monthly_report':
        return tier === 'pro' || tier === 'premium';
        
      case 'roast_mode':
        return tier === 'premium';
        
      case 'subscription_hunter':
        return tier === 'premium';
        
      default:
        return false;
    }
  }

  getFeatureBadge(feature: Feature): { label: string, severity: 'success' | 'info' | 'warn' | 'danger' } | null {
    if (this.canAccess(feature)) return null;

    // Return what is needed
    if (feature === 'monthly_report') return { label: 'PRO', severity: 'info' };
    if (feature === 'roast_mode') return { label: 'PREMIUM', severity: 'warn' };
    if (feature === 'subscription_hunter') return { label: 'PREMIUM', severity: 'warn' };
    
    return null;
  }
}
