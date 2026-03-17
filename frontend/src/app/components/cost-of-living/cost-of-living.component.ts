import { Component, OnInit, signal, effect, computed } from '@angular/core';
import { CommonModule, CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { TabsModule } from 'primeng/tabs';
import { MessageModule } from 'primeng/message';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { MarkdownModule } from 'ngx-markdown';
import {
  trigger,
  transition,
  style,
  animate,
  query,
  group,
} from '@angular/animations';

import {
  AnalysisService,
  MonthlyAverageResponse,
  InflationResponse,
  Anomaly,
  SubscriptionCandidate,
} from '../../services/analysis.service';
import { AIService } from '../../services/ai.service';
import { SubscriptionService } from '../../services/subscription.service';
import { DashboardService } from '../../services/dashboard.service';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { PageHelpComponent } from '../page-help/page-help';

interface Message {
  severity: 'success' | 'info' | 'warn' | 'error' | 'secondary' | 'contrast';
  summary: string;
  detail: string;
}

@Component({
  selector: 'app-cost-of-living',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ChartModule,
    TableModule,
    CardModule,
    ButtonModule,
    InputNumberModule,
    TabsModule,
    MessageModule,
    TooltipModule,
    CurrencyPipe,
    DecimalPipe,
    SkeletonModule,
    MarkdownModule,
    PageHelpComponent,
  ],
  templateUrl: './cost-of-living.component.html',
  styleUrl: './cost-of-living.component.scss',
  animations: [
    trigger('tabAnimation', [
      transition(':increment', [
        style({ position: 'relative', overflow: 'hidden' }),
        query(
          ':enter, :leave',
          [
            style({
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
            }),
          ],
          { optional: true },
        ),
        query(':enter', [style({ left: '100%', opacity: 0 })], {
          optional: true,
        }),
        group([
          query(
            ':leave',
            [animate('300ms ease-out', style({ left: '-100%', opacity: 0 }))],
            { optional: true },
          ),
          query(
            ':enter',
            [animate('300ms ease-out', style({ left: '0%', opacity: 1 }))],
            { optional: true },
          ),
        ]),
      ]),
      transition(':decrement', [
        style({ position: 'relative', overflow: 'hidden' }),
        query(
          ':enter, :leave',
          [
            style({
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
            }),
          ],
          { optional: true },
        ),
        query(':enter', [style({ left: '-100%', opacity: 0 })], {
          optional: true,
        }),
        group([
          query(
            ':leave',
            [animate('300ms ease-out', style({ left: '100%', opacity: 0 }))],
            { optional: true },
          ),
          query(
            ':enter',
            [animate('300ms ease-out', style({ left: '0%', opacity: 1 }))],
            { optional: true },
          ),
        ]),
      ]),
    ]),
  ],
})
export class CostOfLivingComponent implements OnInit {
  // Signals for state
  loading = signal(false);
  activeTab = signal(0);
  data = signal<MonthlyAverageResponse | null>(null);
  inflation = signal<InflationResponse | null>(null);
  anomalies = signal<Anomaly[]>([]);
  subscriptions = signal<SubscriptionCandidate[]>([]);
  income = signal(0);

  // Projection State
  baseMonthlyCost = signal(0);
  inflationRate = signal(4.5);
  projectionYears = signal(10);

  // Chart Data Signals
  breakdownChartData = signal<any>(null);
  breakdownChartOptions = signal<any>(null);
  selectedCategory = signal<string | null>(null);

  // Table Data (Sorted)
  tableData = computed(() => {
    const data = this.data();
    if (!data || !data.realized.by_category) return [];

    const colors = this.generateColors(
      Object.keys(data.realized.by_category).length,
    );

    return Object.entries(data.realized.by_category)
      .map(([category, value], index) => ({
        category,
        value,
        color: colors[index],
      }))
      .sort((a, b) => b.value - a.value);
  });

  projectionChartData = signal<any>(null);
  projectionChartOptions = signal<any>(null);

  // UX
  inflationMessages: Message[] = [];
  insufficientData = signal(false);

  // AI Analysis (Premium)
  aiAnalysis = signal<string | null>(null);
  aiLoading = signal(false);

  // Constants for template
  protected readonly Infinity = Infinity;

  subscriptionService = inject(SubscriptionService);
  canAccess = computed(() =>
    this.subscriptionService.canAccess('cost_of_living'),
  );
  canUseAi = computed(() => this.subscriptionService.canAccess('ai_advisor'));
  canUsePremium = computed(() =>
    this.subscriptionService.canAccess('subscription_hunter'),
  );

  // Computed Financial Metrics
  totalMonthlyCost = computed(() => this.data()?.total_estimated_monthly || 0);
  savingsCapacity = computed(() =>
    Math.max(0, this.income() - this.totalMonthlyCost()),
  );
  savingsRate = computed(() =>
    this.income() > 0 ? (this.savingsCapacity() / this.income()) * 100 : 0,
  );

  // FIRE Number (25x annual cost)
  fireNumber = computed(() => this.totalMonthlyCost() * 12 * 25);

  // Years to FIRE (Simplified 4% rule assumption)
  // We assume user saves the savingsCapacity every month
  yearsToFire = computed(() => {
    const monthlySavings = this.savingsCapacity();
    const target = this.fireNumber();
    if (monthlySavings <= 0) return Infinity;
    return target / (monthlySavings * 12);
  });

  private router = inject(Router);
  private dashboardService = inject(DashboardService);

  navigateToPricing() {
    this.router.navigate(['/pricing']);
  }

  constructor(
    private analysisService: AnalysisService,
    private aiService: AIService,
  ) {
    // Inject AIService
    // Effect to update breakdown chart when data changes
    effect(() => {
      const d = this.data();
      if (d) {
        this.initBreakdownChart(d);
        // Initialize projection base cost if 0
        if (this.baseMonthlyCost() === 0) {
          this.baseMonthlyCost.set(d.total_estimated_monthly);
        }

        // Check for Insufficient Data
        if (d.total_estimated_monthly === 0) {
          this.insufficientData.set(true);
        } else {
          this.insufficientData.set(false);
        }
      }
    });

    // Effect to update projection chart when inputs change
    effect(() => {
      this.updateProjectionChart();
    });
  }

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading.set(true);
    const today = new Date();

    // Load Income from Dashboard (Current Month)
    this.dashboardService
      .getSummary(today.getMonth() + 1, today.getFullYear())
      .subscribe({
        next: (res) => this.income.set(res.income_month),
        error: (err) => console.error(err),
      });

    // Load Averages
    this.analysisService.getMonthlyAverages().subscribe({
      next: (res) => this.data.set(res),
      error: (err) => console.error(err),
    });

    // Load Inflation
    this.analysisService.getInflationRate().subscribe({
      next: (res) => {
        this.inflation.set(res);
        this.inflationRate.set(res.rate);
        if (res.is_fallback) {
          this.inflationMessages = [
            { severity: 'warn', summary: 'Atenção', detail: res.message },
          ];
        }
      },
      error: (err) => console.error(err),
    });

    // Load Anomalies
    this.analysisService.getAnomalies().subscribe({
      next: (res) => this.anomalies.set(res),
      error: (err) => console.error(err),
    });

    // Load Subscriptions (Premium only)
    if (this.canUsePremium()) {
      this.analysisService.getSubscriptions().subscribe({
        next: (res) => this.subscriptions.set(res),
        error: (err) => console.error(err),
      });
    }

    this.loading.set(false);
  }
  analyzeWithAi() {
    const d = this.data();
    if (!d || d.total_estimated_monthly === 0) return;

    this.aiLoading.set(true);
    // Calling AI Service
    this.aiService.analyzeCostOfLiving(d).subscribe({
      next: (res: { analysis: string }) => {
        this.aiAnalysis.set(res.analysis);
        this.aiLoading.set(false);
      },
      error: (err: any) => {
        console.error(err);
        this.aiLoading.set(false);
      },
    });
  }

  selectCategory(category: string | null) {
    if (this.selectedCategory() === category) {
      this.selectedCategory.set(null);
    } else {
      this.selectedCategory.set(category);
    }
  }

  initBreakdownChart(data: MonthlyAverageResponse) {
    const categories = Object.keys(data.realized.by_category);
    const values = Object.values(data.realized.by_category);
    const colors = this.generateColors(categories.length);

    this.breakdownChartData.set({
      labels: categories,
      datasets: [
        {
          data: values,
          backgroundColor: colors,
          hoverBackgroundColor: colors,
          borderWidth: 0,
          borderRadius: 4,
          spacing: 2,
        },
      ],
    });

    const documentStyle = getComputedStyle(document.documentElement);
    const textColor = documentStyle.getPropertyValue('--text-color');

    this.breakdownChartOptions.set({
      cutout: '70%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 20,
            color: textColor,
            font: {
              size: 11,
              weight: 'bold',
            },
          },
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          padding: 12,
          boxPadding: 6,
          usePointStyle: true,
          callbacks: {
            label: (context: any) => {
              const label = context.label || '';
              const value = context.raw || 0;
              const total = context.dataset.data.reduce(
                (a: number, b: number) => a + b,
                0,
              );
              const percentage = ((value / total) * 100).toFixed(1);
              return ` ${label}: R$ ${value.toLocaleString('pt-BR')} (${percentage}%)`;
            },
          },
        },
      },
      onClick: (event: any, elements: any) => {
        if (elements && elements.length > 0) {
          const index = elements[0].index;
          const category = this.breakdownChartData().labels[index];
          this.selectCategory(category);
        } else {
          this.selectCategory(null);
        }
      },
    });
  }
  updateProjectionChart() {
    const base = this.baseMonthlyCost();
    const rate = this.inflationRate() / 100;
    const years = this.projectionYears();

    const labels = [];
    const values = [];

    let current = base;
    for (let i = 0; i <= years; i++) {
      labels.push(`Ano ${i}`);
      values.push(current);
      current = current * (1 + rate);
    }

    const documentStyle = getComputedStyle(document.documentElement);
    const primaryColor = documentStyle.getPropertyValue('--p-primary-500') || '#3b82f6';
    const textColorSecondary = documentStyle.getPropertyValue('--text-color-secondary');
    const surfaceBorder = documentStyle.getPropertyValue('--surface-border');

    this.projectionChartData.set({
      labels: labels,
      datasets: [
        {
          label: 'Custo Mensal Projetado',
          data: values,
          fill: 'start',
          borderColor: primaryColor,
          backgroundColor: primaryColor + '15',
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: primaryColor,
          borderWidth: 3,
        },
      ],
    });

    this.projectionChartOptions.set({
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          padding: 12,
        },
      },
      scales: {
        y: {
          ticks: {
            color: textColorSecondary,
            callback: (value: any) => 'R$ ' + value.toLocaleString('pt-BR'),
          },
          grid: { color: surfaceBorder, drawBorder: false },
        },
        x: {
          ticks: { color: textColorSecondary },
          grid: { display: false },
        },
      },
    });
  }
  getYearlyProjection(yearOffset: number): number {
    const base = this.baseMonthlyCost();
    const rate = this.inflationRate() / 100;
    return base * Math.pow(1 + rate, yearOffset);
  }

  generateColors(count: number): string[] {
    const documentStyle = getComputedStyle(document.documentElement);
    const baseColors = [
      '--p-primary-500',
      '--p-emerald-500',
      '--p-amber-500',
      '--p-violet-500',
      '--p-rose-500',
      '--p-cyan-500',
      '--p-orange-500',
      '--p-indigo-500',
      '--p-teal-500',
      '--p-slate-500',
    ];

    return Array.from({ length: count }, (_, i) => {
      const varName = baseColors[i % baseColors.length];
      const color = documentStyle.getPropertyValue(varName).trim();
      return color || '#ccc';
    });
  }
}
