import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaymentService } from '../../services/payment.service';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { FormsModule } from '@angular/forms';
import { SubscriptionService } from '../../services/subscription.service';
import { UserPreferenceService } from '../../services/user-preference.service';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { FirebaseWrapperService } from '../../services/firebase-wrapper.service';
import { AuthService } from '../../services/auth.service';
import {
  LucideAngularModule,
  Check,
  Zap,
  Star,
  Plus,
  Rocket,
  ShieldCheck,
  MessagesSquare,
  Sparkles,
  TrendingUp,
  Crown,
} from 'lucide-angular';

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    CardModule,
    TagModule,
    ToggleButtonModule,
    FormsModule,
    LucideAngularModule,
    ToastModule,
  ],
  providers: [MessageService],
  templateUrl: './pricing.component.html',
  styleUrl: './pricing.component.scss',
})
export class PricingComponent implements OnInit {
  readonly Check = Check;
  readonly Zap = Zap;
  readonly Star = Star;
  readonly Plus = Plus;
  readonly Rocket = Rocket;
  readonly ShieldCheck = ShieldCheck;
  readonly MessagesSquare = MessagesSquare;
  readonly Sparkles = Sparkles;
  readonly TrendingUp = TrendingUp;
  readonly Crown = Crown;

  private paymentService = inject(PaymentService);
  private subscriptionService = inject(SubscriptionService);
  private preferenceService = inject(UserPreferenceService);
  private messageService = inject(MessageService);
  private router = inject(Router);
  private firebaseService = inject(FirebaseWrapperService);
  private authService = inject(AuthService);

  isAnnual = signal(true);
  loading = signal<string | null>(null);
  paymentPending = signal<string | null>(null);

  // Expose current tier to disable buttons
  currentTier = this.subscriptionService.currentTier;

  private readonly PAYMENT_PENDING_KEY = 'payment_pending';

  ngOnInit() {
    const intentStr = localStorage.getItem('pending_subscription');
    if (intentStr && this.authService.currentUser()) {
      try {
        const parsed = JSON.parse(intentStr);
        this.isAnnual.set(parsed.isAnnual);
        localStorage.removeItem('pending_subscription');
        this.messageService.add({
          severity: 'info',
          summary: 'Bem-vindo!',
          detail: 'Você pode agora confirmar sua assinatura do plano escolhido.',
          life: 5000,
        });
      } catch (e) {
        localStorage.removeItem('pending_subscription');
      }
    }

    const pending = localStorage.getItem(this.PAYMENT_PENDING_KEY);
    if (!pending) return;

    if (this.currentTier() !== 'free') {
      // Tier already updated — just clean up
      localStorage.removeItem(this.PAYMENT_PENDING_KEY);
      return;
    }

    // Payment is pending, start polling the backend
    this.paymentPending.set(pending);
    this.pollForTierUpdate(1);
  }

  private pollForTierUpdate(attempt: number) {
    const MAX_ATTEMPTS = 12;
    const RETRY_DELAY = 2000; // 2s between checks — 24s total window

    setTimeout(() => {
      // Fetch fresh preferences from backend (bypass version cache)
      this.preferenceService.fetchPreferences(true).subscribe({
        next: (prefs) => {
          if (prefs?.subscription_tier !== 'free') {
            // Webhook landed — tier updated
            this.paymentPending.set(null);
            localStorage.removeItem(this.PAYMENT_PENDING_KEY);
            this.messageService.add({
              severity: 'success',
              summary: 'Assinatura Ativa!',
              detail: `Parabéns! Seu plano ${prefs.subscription_tier?.toUpperCase()} está liberado.`,
              life: 6000,
            });
          } else if (attempt < MAX_ATTEMPTS) {
            this.pollForTierUpdate(attempt + 1);
          } else {
            // Timed out — hide the spinner but KEEP the localStorage flag
            // so next time the user opens this page it will poll again
            this.paymentPending.set(null);
            this.messageService.add({
              severity: 'info',
              summary: 'Pagamento em processamento',
              detail:
                'Seu pagamento foi confirmado. Os recursos serão liberados assim que o processamento for concluído.',
              life: 10000,
            });
          }
        },
        error: () => {
          if (attempt < MAX_ATTEMPTS) {
            this.pollForTierUpdate(attempt + 1);
          } else {
            this.paymentPending.set(null);
          }
        },
      });
    }, RETRY_DELAY);
  }

  features = {
    free: [
      'Gestão de Transações Ilimitada',
      'Contas e Categorias Personalizáveis',
      'Dashboard Financeiro Essencial',
      'Controle Manual de Gastos',
    ],
    pro: [
      'Classificação Automática por IA de recibos',
      'Até 50 scans/chats de IA por dia',
      'Relatórios Mensais Inteligentes',
      'Importação de extratos bancários',
      'Gestão Completa de Cartões',
      'Advisor Financeiro Pessoal (IA)',
    ],
    premium: [
      'Tudo do plano Pro',
      'Até 10x mais interações de IA que o plano Pro',
      'IA Scanner de Documentos Complexos',
      'Análise Proativa de Custo de Vida',
      'Detector de Anomalias e Gastos Fantasmas',
      'Caçador de Assinaturas Esquecidas',
      'Modelos de IA de Alta Performance',
      'Modo Roast (Análise Sarcástica de Gastos)',
    ],
  };

  async subscribe(plan: 'pro' | 'premium') {
    if (this.currentTier() === plan) return;

    if (!this.authService.currentUser()) {
      localStorage.setItem('pending_subscription', JSON.stringify({ plan, isAnnual: this.isAnnual() }));
      this.router.navigate(['/login'], { queryParams: { mode: 'register', intent: 'subscribe' } });
      return;
    }

    const interval = this.isAnnual() ? 'yearly' : 'monthly';
    const planId = `${plan}_${interval}` as
      | 'pro_monthly'
      | 'pro_yearly'
      | 'premium_monthly'
      | 'premium_yearly';

    this.firebaseService.logEvent('begin_checkout', {
      plan_id: planId,
      plan_name: plan,
      billing_interval: interval
    });

    this.loading.set(plan);
    this.paymentService.createCheckoutSession(planId).subscribe({
      next: (res) => {
        localStorage.setItem(this.PAYMENT_PENDING_KEY, planId);
        window.location.href = res.url;
      },
      error: (err) => {
        console.error('Error creating session', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Erro de Conexão',
          detail:
            'Não foi possível iniciar o checkout. Verifique sua conexão ou tente novamente mais tarde.',
        });
        this.loading.set(null);
      },
    });
  }

  manageSubscription() {
    // Não abre portal se o usuário nunca teve assinatura
    if (this.currentTier() === 'free') {
      this.messageService.add({
        severity: 'info',
        summary: 'Sem assinatura ativa',
        detail: 'Você não possui uma assinatura para gerenciar.',
      });
      return;
    }

    this.loading.set('manage');
    this.paymentService.createPortalSession().subscribe({
      next: (res) => {
        window.location.href = res.url;
      },
      error: (err) => {
        console.error('Error opening portal', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Acesso Negado',
          detail: 'Não foi possível carregar o portal de gerenciamento.',
        });
        this.loading.set(null);
      },
    });
  }
}
