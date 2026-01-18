import { Injectable, computed, inject, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { UserPreferenceService } from './user-preference.service';
import { UserPreference } from '../models/user-preference.model';

export type Feature =
  'monthly_report' |
  'roast_mode' |
  'subscription_hunter' |
  'recurring_dashboard' |
  'chat' |
  'cost_of_living' |
  'import' |
  'credit_card_mgmt' |
  'receipt_scanner' |
  'ai_advisor' |
  'invoices' |
  'debts';

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

    // Free has almost nothing (except basic management which is not flagged here, and recurring dashboard)
    if (tier === 'free') {
        if (feature === 'recurring_dashboard') return true;
        return false;
    }

    // Pro Access
    if (tier === 'pro') {
        if (feature === 'roast_mode') return false;
        if (feature === 'subscription_hunter') return false;
        return true;
        // Pro has access to:
        // - monthly_report (Simple)
        // - cost_of_living
        // - import
        // - credit_card_mgmt
        // - receipt_scanner (Simple)
        // - chat
        // - recurring_dashboard
        // - invoices
    }

    // Premium Access (Everything)
    return true;
  }

  getFeatureBadge(feature: Feature): { label: string, severity: 'success' | 'info' | 'warn' | 'danger' } | null {
    if (this.canAccess(feature)) return null;

    // Return what is needed
    if (feature === 'monthly_report') return { label: 'PRO', severity: 'info' };
    if (feature === 'chat') return { label: 'PRO', severity: 'info' };
    if (feature === 'cost_of_living') return { label: 'PRO', severity: 'info' };
    if (feature === 'import') return { label: 'PRO', severity: 'info' };
    if (feature === 'invoices') return { label: 'PRO', severity: 'info' };
    if (feature === 'credit_card_mgmt') return { label: 'PRO', severity: 'info' };
    if (feature === 'receipt_scanner') return { label: 'PRO', severity: 'info' };
    if (feature === 'debts') return { label: 'PRO', severity: 'info' };

    if (feature === 'roast_mode') return { label: 'PREMIUM', severity: 'warn' };
    if (feature === 'subscription_hunter') return { label: 'PREMIUM', severity: 'warn' };

    return null;
  }
}
