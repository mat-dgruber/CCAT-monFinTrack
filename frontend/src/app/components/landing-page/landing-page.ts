import {
  Component,
  AfterViewInit,
  OnInit,
  OnDestroy,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import {
  LucideAngularModule,
  BrainCircuit,
  ScanLine,
  LineChart,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Zap,
  TrendingDown,
  Lock,
  MessageSquare,
  Facebook,
  Instagram,
  Twitter,
  Linkedin,
  Github,
  CreditCard,
  Target,
  Repeat,
  Calendar,
  MapPin,
} from 'lucide-angular';
import { PricingComponent } from '../pricing/pricing.component';
import * as AnimeJS from 'animejs';
const anime: any = (AnimeJS as any).default ?? AnimeJS;

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ButtonModule,
    LucideAngularModule,
    PricingComponent,
    ToastModule,
  ],
  providers: [MessageService],
  templateUrl: './landing-page.html',
  styles: [
    `
      :host {
        display: block;
        background-color: var(--surface-ground);
        overflow-x: hidden;
      }

      .hero-gradient {
        background: radial-gradient(
          circle at 50% 50%,
          rgba(93, 138, 140, 0.1) 0%,
          rgba(244, 238, 224, 0) 70%
        );
      }

      .text-balance {
        text-wrap: balance;
      }

      @keyframes float {
        0% {
          transform: translateY(0px) rotate(0deg);
        }
        50% {
          transform: translateY(-20px) rotate(1deg);
        }
        100% {
          transform: translateY(0px) rotate(0deg);
        }
      }

      .animate-float {
        animation: float 8s ease-in-out infinite;
      }

      .cta-premium-bg {
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
        position: relative;
        overflow: hidden;
      }

      .ambient-blob {
        position: absolute;
        border-radius: 50%;
        filter: blur(80px);
        z-index: 0;
        pointer-events: none;
        opacity: 0.15;
      }

      .blob-primary {
        background: radial-gradient(
          circle,
          var(--primary-500) 0%,
          transparent 70%
        );
      }
      .blob-orange {
        background: radial-gradient(circle, #f97316 0%, transparent 70%);
      }
      .blob-teal {
        background: radial-gradient(circle, #0d9488 0%, transparent 70%);
      }
      .blob-purple {
        background: radial-gradient(circle, #8b5cf6 0%, transparent 70%);
      }

      @keyframes blob-float {
        0% {
          transform: translate(0, 0) scale(1);
        }
        33% {
          transform: translate(30px, -50px) scale(1.1);
        }
        66% {
          transform: translate(-20px, 20px) scale(0.9);
        }
        100% {
          transform: translate(0, 0) scale(1);
        }
      }

      .animate-blob {
        animation: blob-float 20s infinite alternate
          cubic-bezier(0.45, 0, 0.55, 1);
      }

      :host ::ng-deep .premium-cta-btn.p-button {
        background: linear-gradient(
          135deg,
          #f97316 0%,
          #ec4899 100%
        ) !important;
        background-size: 200% auto !important;
        border: none !important;
        color: white !important;
        position: relative !important;
        overflow: hidden !important;
        transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1) !important;
        z-index: 1 !important;
        box-shadow: 0 10px 30px -5px rgba(236, 72, 153, 0.6) !important;
        padding: 1.5rem 3rem !important;
        border-radius: 9999px !important; /* Pill shape */
      }

      :host ::ng-deep .premium-cta-btn.p-button .p-button-label {
        color: white !important;
        font-weight: 800 !important;
        font-size: 1.25rem !important;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2) !important;
      }

      :host ::ng-deep .premium-cta-btn.p-button .p-button-icon {
        color: white !important;
        font-size: 1.2rem !important;
      }

      :host ::ng-deep .premium-cta-btn.p-button::before {
        content: '';
        position: absolute;
        top: 0;
        left: -150%;
        width: 100%;
        height: 100%;
        background: linear-gradient(
          120deg,
          transparent,
          rgba(255, 255, 255, 0.4),
          transparent
        );
        animation: shimmer 4s infinite linear;
        z-index: 2;
      }

      :host ::ng-deep .premium-cta-btn.p-button:hover {
        transform: translateY(-8px) scale(1.05) !important;
        box-shadow: 0 25px 50px -10px rgba(236, 72, 153, 0.7) !important;
        background-position: right center !important;
      }

      @keyframes shimmer {
        0% {
          left: -150%;
        }
        30% {
          left: 150%;
        }
        100% {
          left: 150%;
        }
      }

      .premium-cta-btn:hover {
        transform: translateY(-8px) scale(1.05);
        box-shadow: 0 25px 50px -10px rgba(236, 72, 153, 0.7) !important;
        background-position: right center !important;
      }

      @keyframes shimmer {
        0% {
          left: -100%;
        }
        20% {
          left: 100%;
        }
        100% {
          left: 100%;
        }
      }

      .premium-cta-btn:hover {
        transform: translateY(-5px) scale(1.02);
        box-shadow: 0 20px 40px rgba(236, 72, 153, 0.4) !important;
      }

      .pulse-animation {
        animation: pulse-glow 2s infinite;
      }

      @keyframes pulse-glow {
        0% {
          box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.4);
        }
        70% {
          box-shadow: 0 0 0 20px rgba(249, 115, 22, 0);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(249, 115, 22, 0);
        }
      }
    `,
  ],
})
export class LandingPage implements OnInit, AfterViewInit, OnDestroy {
  readonly BrainCircuit = BrainCircuit;
  readonly ScanLine = ScanLine;
  readonly LineChart = LineChart;
  readonly ShieldCheck = ShieldCheck;
  readonly ArrowRight = ArrowRight;
  readonly Sparkles = Sparkles;
  readonly Zap = Zap;
  readonly TrendingDown = TrendingDown;
  readonly Lock = Lock;
  readonly MessageSquare = MessageSquare;
  readonly Facebook = Facebook;
  readonly Instagram = Instagram;
  readonly Twitter = Twitter;
  readonly Linkedin = Linkedin;
  readonly Github = Github;
  readonly CreditCard = CreditCard;
  readonly Target = Target;
  readonly Repeat = Repeat;
  readonly Calendar = Calendar;
  readonly MapPin = MapPin;

  isScrolled = false;
  currentYear = new Date().getFullYear();
  private observer: IntersectionObserver | null = null;

  constructor(
    private messageService: MessageService,
    private titleService: Title,
    private metaService: Meta,
  ) {}

  ngOnInit() {
    this.setSeoTags();
  }

  features = [
    {
      icon: ScanLine,
      title: 'Scanner Inteligente',
      description:
        'Tire uma foto do seu recibo e deixe a IA extrair valores, datas e categorias automaticamente.',
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
    },
    {
      icon: BrainCircuit,
      title: 'Análise Preditiva',
      description:
        'Entenda seu custo de vida e receba projeções reais baseadas no seu comportamento de gastos.',
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      icon: MessageSquare,
      title: 'IA Advisor (Modo Roast)',
      description:
        'Um mentor financeiro que não tem medo de falar a verdade. Peça dicas ou receba um "puxão de orelha".',
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
    },
    {
      icon: ShieldCheck,
      title: 'Privacidade Total',
      description:
        'Seus dados financeiros são protegidos com criptografia de ponta e nunca são vendidos.',
      color: 'text-green-500',
      bg: 'bg-green-500/10',
    },
    {
      icon: Target,
      title: 'Plano de Metas',
      description:
        'Defina orçamentos por categoria e acompanhe seu progresso em tempo real com alertas inteligentes.',
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      icon: Repeat,
      title: 'Gestão de Assinaturas',
      description:
        'Visualize todos os seus serviços recorrentes e identifique cobranças indesejadas instantaneamente.',
      color: 'text-indigo-500',
      bg: 'bg-indigo-500/10',
    },
    {
      icon: Calendar,
      title: 'Agenda Financeira',
      description:
        'Nunca mais atrase uma conta. Veja seus vencimentos em uma visão mensal prática e organizada.',
      color: 'text-rose-500',
      bg: 'bg-rose-500/10',
    },
    {
      icon: MapPin,
      title: 'Custo de Vida',
      description:
        'Descubra quanto você gasta por localidade e analise o impacto geográfico nas suas finanças.',
      color: 'text-cyan-500',
      bg: 'bg-cyan-500/10',
    },
  ];

  faqs = [
    {
      question: 'Meus dados estão seguros?',
      answer:
        'Sim. Utilizamos criptografia de nível bancário e autenticação sólida através do Google Firebase. Seus dados são privados e nunca são compartilhados ou vendidos.',
    },
    {
      question: 'A IA realmente classifica tudo sozinha?',
      answer:
        'Nossa IA alcança mais de 98% de precisão. O Scanner de Recibos processa a imagem e extrai automaticamente o valor, data e a categoria correta, eliminando o trabalho manual.',
    },
    {
      question: 'Posso importar dados do meu banco?',
      answer:
        'Sim! Além do lançamento manual e do Scanner de IA, você pode importar seus extratos via arquivos CSV ou OFX, mantendo seu histórico sempre atualizado.',
    },
    {
      question: 'O monFinTrack tem aplicativo para celular?',
      answer:
        'O monFinTrack foi construído como um PWA (Progressive Web App). Isso significa que você pode instalá-lo diretamente no seu iPhone ou Android sem precisar da App Store, tendo uma experiência de app nativo.',
    },
    {
      question: 'Qual o diferencial em relação a uma planilha?',
      answer:
        'Diferente de uma planilha estática, o monFinTrack oferece análise preditiva com IA, alertas automáticos, gestão de assinaturas e um Advisor que te dá conselhos reais para economizar dinheiro de forma estratégica.',
    },
    {
      question: 'Posso cancelar minha assinatura quando quiser?',
      answer:
        'Sem restrições. Todas as assinaturas são gerenciadas via Stripe Customer Portal, onde você tem controle total para cancelar ou alterar seu plano com apenas um clique.',
    },
  ];

  activeFaqIndex: number | null = null;

  ngAfterViewInit() {
    // Garante que o Angular terminou o ciclo de renderização
    setTimeout(() => {
      this.initHeroAnimation();
      this.initScrollAnimations();
    }, 100);
  }

  ngOnDestroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.isScrolled = window.scrollY > 20;
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(e: MouseEvent) {
    const preview = document.querySelector('.hero-preview') as HTMLElement;
    if (!preview) return;

    const x = (window.innerWidth / 2 - e.pageX) / 60;
    const y = (window.innerHeight / 2 - e.pageY) / 60;

    anime({
      targets: preview,
      rotateY: x,
      rotateX: -y,
      duration: 400,
      easing: 'easeOutQuad',
    });
  }

  onBtnEnter(event: MouseEvent) {
    const target = event.currentTarget as HTMLElement;
    anime({
      targets: target,
      scale: 1.05,
      duration: 800,
      easing: 'easeOutElastic(1, .6)',
    });
  }

  onBtnLeave(event: MouseEvent) {
    const target = event.currentTarget as HTMLElement;
    anime({
      targets: target,
      scale: 1,
      duration: 600,
      easing: 'easeOutElastic(1, .6)',
    });
  }

  onCardMove(e: MouseEvent) {
    const card = e.currentTarget as HTMLElement;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = (y - centerY) / 4;
    const rotateY = (centerX - x) / 4;

    anime({
      targets: card,
      rotateX: rotateX,
      rotateY: rotateY,
      scale: 1.08,
      boxShadow: '0 40px 80px -20px rgba(0,0,0,0.25)',
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
      boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)',
      duration: 600,
      easing: 'easeOutElastic(1, .8)',
    });
  }

  onMagneticMove(e: MouseEvent) {
    const btn = e.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    anime({
      targets: btn,
      translateX: x * 0.65,
      translateY: y * 0.65,
      duration: 400,
      easing: 'easeOutQuad',
    });
  }

  onMagneticLeave(e: MouseEvent) {
    const btn = e.currentTarget as HTMLElement;
    anime({
      targets: btn,
      translateX: 0,
      translateY: 0,
      duration: 600,
      easing: 'easeOutElastic(1, .8)',
    });
  }

  checkStatus(event: Event) {
    event.preventDefault();
    this.messageService.add({
      severity: 'success',
      summary: 'Sistemas Operacionais',
      detail:
        'Todos os serviços estão funcionando normalmente. API: 🟢 | DB: 🟢',
      life: 5000,
    });
  }

  private initHeroAnimation() {
    const tl = anime.timeline({
      easing: 'easeOutElastic(1, .8)',
    });

    tl.add({
      targets: '.hero-badge',
      opacity: [0, 1],
      translateY: [30, 0],
      duration: 1200,
      delay: 400,
    })
      .add(
        {
          targets: '.hero-title',
          opacity: [0, 1],
          translateY: [40, 0],
          scale: [0.95, 1],
          duration: 1500,
        },
        '-=1000',
      )
      .add(
        {
          targets: '.hero-p',
          opacity: [0, 1],
          translateY: [20, 0],
          duration: 1000,
          easing: 'easeOutQuad',
        },
        '-=1200',
      )
      .add(
        {
          targets: '.hero-btns p-button',
          opacity: [0, 1],
          scale: [0.8, 1],
          delay: anime.stagger(150),
          duration: 1000,
        },
        '-=1000',
      )
      .add(
        {
          targets: '.hero-preview',
          opacity: [0, 1],
          translateY: [60, 0],
          rotateX: [15, 0],
          duration: 2000,
          easing: 'easeOutExpo',
        },
        '-=1200',
      );
  }

  private initScrollAnimations() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLElement;
            const animationType = target.getAttribute('data-anime');

            if (animationType === 'stagger-features') {
              this.animateFeatures();
            } else if (animationType === 'reveal-up') {
              this.animateRevealUp(target);
            } else if (animationType === 'ai-section') {
              this.animateAISection();
            } else if (animationType === 'stats-section') {
              this.animateStats();
            }

            this.observer?.unobserve(target);
          }
        });
      },
      { threshold: 0.15 },
    );

    document.querySelectorAll('[data-anime]').forEach((el) => {
      this.observer?.observe(el);
    });
  }

  private animateFeatures() {
    anime({
      targets: '.feature-card',
      opacity: [0, 1],
      translateY: [50, 0],
      rotateY: [10, 0],
      delay: anime.stagger(100, { from: 'center' }),
      duration: 1200,
      easing: 'easeOutElastic(1, .9)',
    });
  }

  private animateRevealUp(el: HTMLElement) {
    anime({
      targets: el,
      opacity: [0, 1],
      translateY: [40, 0],
      duration: 1000,
      easing: 'easeOutQuad',
    });
  }

  private animateStats() {
    anime({
      targets: '.stat-item',
      opacity: [0, 1],
      scale: [0.5, 1],
      delay: anime.stagger(100),
      duration: 800,
      easing: 'easeOutBack',
    });

    const stats = document.querySelectorAll('.stat-value');
    stats.forEach((stat) => {
      const startValue = parseInt(stat.getAttribute('data-start') || '0');
      const targetValue = parseInt(stat.getAttribute('data-target') || '0');
      const obj = { value: startValue };
      anime({
        targets: obj,
        value: targetValue,
        round: 1,
        duration: 2500,
        easing: 'easeOutExpo',
        delay: 500,
        update: () => {
          stat.innerHTML = obj.value.toString();
        },
      });
    });
  }

  private animateAISection() {
    const tl = anime.timeline({
      easing: 'easeOutExpo',
    });

    tl.add({
      targets: '.ai-content',
      opacity: [0, 1],
      translateX: [-50, 0],
      duration: 1200,
    }).add(
      {
        targets: '.ai-visual',
        opacity: [0, 1],
        scale: [0.9, 1],
        duration: 1200,
      },
      '-=1000',
    );
    // Removed old .ai-bubble stagger as it's now handled by the synchronized loop below

    // Precise synchronization for bubbles
    const bubbles = document.querySelectorAll('.ai-bubble-text');
    let cumulativeDelay = 2000;

    bubbles.forEach((bubble, i) => {
      const text = bubble.getAttribute('data-text') || '';
      const typingDuration = text.length * 40; // Slightly slower typing for readability

      // Animate the container reveal (the parent of the parent of .ai-bubble-text)
      const container = bubble.closest('.ai-bubble') as HTMLElement;

      anime({
        targets: container,
        opacity: [0, 1],
        translateY: [20, 0],
        scale: [0.9, 1],
        duration: 800,
        delay: cumulativeDelay - 500, // Show container just before typing starts
        easing: 'easeOutQuart',
      });

      // Typing effect
      bubble.innerHTML = '';
      anime({
        targets: bubble,
        update: (anim: any) => {
          const count = Math.floor(anim.progress * (text.length / 100));
          bubble.innerHTML = text.substring(0, count);
        },
        duration: typingDuration,
        delay: cumulativeDelay,
        easing: 'linear',
      });

      cumulativeDelay += typingDuration + 1500; // Wait for typing + pause before next bubble
    });

    // Glow pulse for AI Logo
    anime({
      targets: '.ai-logo-glow',
      opacity: [0.2, 0.6],
      scale: [1, 1.1],
      duration: 1500,
      direction: 'alternate',
      loop: true,
      easing: 'easeInOutQuad',
    });
  }

  toggleFaq(index: number) {
    const wrappers = document.querySelectorAll('.faq-content-wrapper');
    const oldIndex = this.activeFaqIndex;

    // Close previously active one if it's different
    if (oldIndex !== null && oldIndex !== index) {
      anime({
        targets: wrappers[oldIndex],
        height: 0,
        opacity: 0,
        duration: 500,
        easing: 'easeOutExpo',
      });
    }

    // Toggle state
    this.activeFaqIndex = this.activeFaqIndex === index ? null : index;

    if (this.activeFaqIndex !== null) {
      const target = wrappers[index] as HTMLElement;

      // Get height by temporarily setting it to auto
      target.style.height = 'auto';
      const height = target.scrollHeight;
      target.style.height = '0';

      anime({
        targets: target,
        height: height,
        opacity: 1,
        duration: 1000,
        easing: 'easeOutElastic(1, .8)',
      });
    } else {
      // Closing current one
      anime({
        targets: wrappers[index],
        height: 0,
        opacity: 0,
        duration: 500,
        easing: 'easeOutExpo',
      });
    }
  }

  private setSeoTags() {
    this.titleService.setTitle(
      'monFinTrack - Gestão Financeira com Inteligência Artificial',
    );

    this.metaService.addTags([
      {
        name: 'description',
        content:
          'Transforme sua vida financeira com a IA do monFinTrack. Scanner de recibos, análise preditiva de gastos e advisor personalizado para economizar de verdade.',
      },
      {
        name: 'keywords',
        content:
          'finanças pessoais, inteligência artificial, controle de gastos, scanner de recibos, gestão de dívidas, planejamento financeiro',
      },
      { name: 'robots', content: 'index, follow' },
      { name: 'author', content: 'monFinTrack Team' },
      {
        property: 'og:title',
        content: 'monFinTrack - Sua IA Financeira Pessoal',
      },
      {
        property: 'og:description',
        content:
          'Pare de brigar com planilhas. Use IA para organizar seus gastos e projetar seu futuro financeiro.',
      },
      { property: 'og:image', content: 'assets/social-banner.png' },
      { property: 'og:url', content: 'https://monfintrack.com.br' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
      {
        name: 'twitter:title',
        content: 'monFinTrack - O futuro do controle financeiro',
      },
      {
        name: 'twitter:description',
        content: 'Inteligência Artificial que realmente entende seu dinheiro.',
      },
      { name: 'twitter:image', content: 'assets/social-banner.png' },
    ]);
  }
}
