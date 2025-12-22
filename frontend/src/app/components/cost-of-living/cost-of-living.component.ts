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

import { AnalysisService, MonthlyAverageResponse, InflationResponse, Anomaly } from '../../services/analysis.service';
import { AIService } from '../../services/ai.service';
import { SubscriptionService } from '../../services/subscription.service';
import { inject } from '@angular/core';

interface Message {
    severity: "success" | "info" | "warn" | "error" | "secondary" | "contrast";
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
    SkeletonModule
  ],
  templateUrl: './cost-of-living.component.html',
  styleUrl: './cost-of-living.component.scss'
})
export class CostOfLivingComponent implements OnInit {

  // Signals for state
  loading = signal(false);
  data = signal<MonthlyAverageResponse | null>(null);
  inflation = signal<InflationResponse | null>(null);
  anomalies = signal<Anomaly[]>([]);

  // Projection State
  baseMonthlyCost = signal(0);
  inflationRate = signal(4.5);
  projectionYears = signal(10);

  // Chart Data Signals
  breakdownChartData = signal<any>(null);
  breakdownChartOptions = signal<any>(null);

  projectionChartData = signal<any>(null);
  projectionChartOptions = signal<any>(null);

  // UX
  inflationMessages: Message[] = [];
  insufficientData = signal(false);

  // AI Analysis (Premium)
  aiAnalysis = signal<string | null>(null);
  aiLoading = signal(false);

  subscriptionService = inject(SubscriptionService);
  canAccess = computed(() => this.subscriptionService.canAccess('cost_of_living'));
  canUseAi = computed(() => this.subscriptionService.canAccess('ai_advisor'));

  // Markdown parsing (simple for now, just preserving newlines)
  formattedAnalysis = computed(() => {
      const raw = this.aiAnalysis();
      if (!raw) return '';
      // Simple format: * -> <li>, ** -> <b>
      let html = raw.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
      html = html.replace(/\n/g, '<br>');
      return html;
  });

  constructor(private analysisService: AnalysisService, private aiService: AIService) { // Inject AIService
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

               this.insufficientData.set(false);

               // Auto-trigger REMOVED as per user request (On-demand only)
               // if (this.canUseAi() && !this.aiAnalysis()) {
               //     this.analyzeWithAi();
               // }
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

    // Load Averages
    this.analysisService.getMonthlyAverages().subscribe({
        next: (res) => this.data.set(res),
        error: (err) => console.error(err)
    });

    // Load Inflation
    this.analysisService.getInflationRate().subscribe({
        next: (res) => {
            this.inflation.set(res);
            this.inflationRate.set(res.rate);
            if (res.is_fallback) {
                this.inflationMessages = [{ severity: 'warn', summary: 'Atenção', detail: res.message }];
            }
        },
        error: (err) => console.error(err)
    });

    // Load Anomalies
    this.analysisService.getAnomalies().subscribe({
        next: (res) => this.anomalies.set(res),
        error: (err) => console.error(err)
    });

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
          }
      });
  }

  initBreakdownChart(data: MonthlyAverageResponse) {
      const categories = Object.keys(data.realized.by_category);
      const values = Object.values(data.realized.by_category);

      this.breakdownChartData.set({
          labels: categories,
          datasets: [
              {
                  data: values,
                  backgroundColor: this.generateColors(categories.length),
                  hoverBackgroundColor: this.generateColors(categories.length) // Simplification
              }
          ]
      });

      const documentStyle = getComputedStyle(document.documentElement);
      const textColor = documentStyle.getPropertyValue('--text-color');

      this.breakdownChartOptions.set({
          plugins: {
              legend: {
                  position: 'right',
                  labels: {
                      usePointStyle: true,
                      color: textColor
                  }
              }
          }
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

      this.projectionChartData.set({
          labels: labels,
          datasets: [
              {
                  label: 'Custo Mensal Projetado',
                  data: values,
                  fill: true,
                  borderColor: '#3b82f6',
                  backgroundColor: 'rgba(59, 130, 246, 0.2)',
                  tension: 0.4
              }
          ]
      });

      const documentStyle = getComputedStyle(document.documentElement);
      const textColor = documentStyle.getPropertyValue('--text-color');
      const textColorSecondary = documentStyle.getPropertyValue('--text-color-secondary');
      const surfaceBorder = documentStyle.getPropertyValue('--surface-border');

      this.projectionChartOptions.set({
          plugins: {
              legend: {
                  labels: { color: textColor }
              }
          },
          scales: {
              y: {
                  ticks: { color: textColorSecondary },
                  grid: { color: surfaceBorder }
              },
              x: {
                  ticks: { color: textColorSecondary },
                  grid: { color: surfaceBorder }
              }
          }
      });
  }

  getYearlyProjection(yearOffset: number): number {
      const base = this.baseMonthlyCost();
      const rate = this.inflationRate() / 100;
      return base * Math.pow(1 + rate, yearOffset);
  }

  generateColors(count: number): string[] {
      // Simple palette generation or preset
      const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#64748b'];
      const result = [];
      for(let i=0; i<count; i++) {
          result.push(colors[i % colors.length]);
      }
      return result;
  }
}
