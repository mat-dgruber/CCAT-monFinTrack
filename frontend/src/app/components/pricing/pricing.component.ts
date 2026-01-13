import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaymentService } from '../../services/payment.service';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { FormsModule } from '@angular/forms';
import { SubscriptionService } from '../../services/subscription.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [CommonModule, ButtonModule, CardModule, TagModule, ToggleButtonModule, FormsModule],
  templateUrl: './pricing.component.html',
  styleUrl: './pricing.component.scss'
})
export class PricingComponent {
  private paymentService = inject(PaymentService);
  private subscriptionService = inject(SubscriptionService);
  private router = inject(Router);

  isAnnual = signal(false);
  loading = signal<string | null>(null);

  // Expose current tier to disable buttons
  currentTier = this.subscriptionService.currentTier;

  features = {
    free: [
        'Gestão de Transações Ilimitada',
        'Contas e Categorias Personalizáveis',
        'Dashboard de Recorrências Básico'
    ],
    pro: [
        'Relatórios Mensais Detalhados',
        'Chat com IA (Advisor Standard)',
        'Gestão de Cartão de Crédito',
        'Importação Inteligente (OFX/Excel)',
        'Scanner de Recibos',
        'Análise de Custo de Vida'
    ],
    premium: [
        'Advisor com IA Avançada',
        'Análise de Sentimento Financeiro',
        'Caçador de Assinaturas (IA)',
        'Modo Roast (Análise Sem Filtro)'
    ]
  };

  async subscribe(plan: 'pro' | 'premium') {
    if (this.currentTier() === plan) return;

    const interval = this.isAnnual() ? 'yearly' : 'monthly';
    const planId = `${plan}_${interval}` as 'pro_monthly' | 'pro_yearly' | 'premium_monthly' | 'premium_yearly';

    this.loading.set(plan);
    this.paymentService.createCheckoutSession(planId).subscribe({
      next: (res) => {
        window.location.href = res.url;
      },
      error: (err) => {
        console.error('Error creating session', err);
        this.loading.set(null);
      }
    });
  }

  manageSubscription() {
      this.loading.set('manage');
      this.paymentService.createPortalSession().subscribe({
          next: (res) => {
              window.location.href = res.url;
          },
          error: (err) => {
              console.error('Error opening portal', err);
              this.loading.set(null);
          }
      });
  }
}
