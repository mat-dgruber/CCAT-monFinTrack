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
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
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
import * as AnimeJS from 'animejs';
const anime: any = (AnimeJS as any).default ?? AnimeJS;

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
export class PricingComponent {
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
  private messageService = inject(MessageService);
  private router = inject(Router);

  isAnnual = signal(true);
  loading = signal<string | null>(null);

  // Expose current tier to disable buttons
  currentTier = this.subscriptionService.currentTier;

  features = {
    free: [
      'Gestão de Transações Ilimitada',
      'Contas e Categorias Personalizáveis',
      'Dashboard Financeiro Essencial',
      'Controle Manual de Gastos',
    ],
    pro: [
      'Classificação Automática por IA',
      'Até 50 scans/chats de IA por dia',
      'Relatórios Mensais Inteligentes',
      'Importação de OFX/Excel/CSV',
      'Gestão Completa de Cartões',
      'Advisor Financeiro Pessoal (IA)',
    ],
    premium: [
      'Até 500 interações de IA por dia',
      'Análise Proativa de Custo de Vida',
      'Detector de Anomalias e Gastos Fantasmas',
      'Caçador de Assinaturas Esquecidas',
      'Modelos de IA de Alta Performance',
      'Modo Roast (Análise Sarcástica de Gastos)',
    ],
  };

  onCardMove(e: MouseEvent) {
    const card = e.currentTarget as HTMLElement;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = (y - centerY) / 25;
    const rotateY = (centerX - x) / 25;

    anime({
      targets: card,
      rotateX: rotateX,
      rotateY: rotateY,
      scale: 1.02,
      duration: 400,
      easing: 'easeOutQuad',
    });
  }

  onCardLeave(e: MouseEvent) {
    const card = e.currentTarget as HTMLElement;
    anime({
      targets: card,
      rotateX: 0,
      rotateY: 0,
      scale: 1,
      duration: 600,
      easing: 'easeOutElastic(1, .8)',
    });
  }

  async subscribe(plan: 'pro' | 'premium') {
    if (this.currentTier() === plan) return;

    const interval = this.isAnnual() ? 'yearly' : 'monthly';
    const planId = `${plan}_${interval}` as
      | 'pro_monthly'
      | 'pro_yearly'
      | 'premium_monthly'
      | 'premium_yearly';

    this.loading.set(plan);
    this.paymentService.createCheckoutSession(planId).subscribe({
      next: (res) => {
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
