import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { MonthSelector } from '../month-selector/month-selector';

// PrimeNG
import { ChartModule } from 'primeng/chart';
import { CardModule } from 'primeng/card';
import { SelectModule } from 'primeng/select'; // For p-select
import { MultiSelectModule } from 'primeng/multiselect'; // For p-multiSelect
import { DatePickerModule } from 'primeng/datepicker';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog'; // Import Dialog
import { MarkdownModule } from 'ngx-markdown'; // Import Markdown Module if used
import { RouterModule } from '@angular/router';


// Services
import { DashboardService, DashboardSummary } from '../../services/dashboard.service';
import { RefreshService } from '../../services/refresh.service';
import { FilterService } from '../../services/filter.service';
import { AccountService } from '../../services/account.service';
import { AnalysisService } from '../../services/analysis.service';
import { AIService } from '../../services/ai.service'; // Import AI Service
import { SubscriptionService } from '../../services/subscription.service';
import { Account } from '../../models/account.model';

// Components
import { AccountManager } from '../account-manager/account-manager';
import { BudgetManager } from '../budget-manager/budget-manager';
import { InvoiceDashboard } from '../invoice-dashboard/invoice-dashboard';
import { RecentTransactionsComponent } from '../recent-transactions/recent-transactions.component';


import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    ChartModule,
    CardModule,
    MonthSelector,
    AccountManager,
    BudgetManager,
    AccountManager,
    BudgetManager,
    InvoiceDashboard,
    RecentTransactionsComponent,
    SkeletonModule,
    DialogModule, // Add Dialog
    MarkdownModule, // Add Markdown
    ButtonModule, // Add Button
    RouterModule
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {

  private dashboardService = inject(DashboardService);
  private refreshService = inject(RefreshService);
  private filterService = inject(FilterService);
  private analysisService = inject(AnalysisService);
  private accountService = inject(AccountService);
  private aiService = inject(AIService); // Inject AI Service
  subscriptionService = inject(SubscriptionService);


  summary = signal<DashboardSummary | null>(null);
  costOfLiving = signal<number | null>(null);
  loading = signal(true);

  // AI Report
  showReportDialog = false;
  reportLoading = false;
  reportContent = '';




  // Filters
  accounts = signal<Account[]>([]);





  constructor() {


    // Efeito para recarregar os dados do dashboard quando o sinal de refresh for acionado
    effect(() => {
      const m = this.filterService.month();
      const y = this.filterService.year();
      this.refreshService.refreshSignal();
      this.loadDashboard(m, y);
    });
  }

  ngOnInit() {
    this.initChartOptions();
    this.loadAccounts();
  }
  // Chart
  chartData: any;
  chartOptions: any;
  chartType = 'doughnut';

  // Evolution Chart
  evolutionChartData: any;
  evolutionChartOptions: any;

  loadAccounts() {
    this.accountService.getAccounts().subscribe(data => this.accounts.set(data));
  }

  generateReport() {
    this.showReportDialog = true;
    this.reportLoading = true;
    this.reportContent = '';
    
    // Use current month/year from filter
    const m = this.filterService.month();
    const y = this.filterService.year();

    this.aiService.generateMonthlyReport(m, y).subscribe({
        next: (res) => {
            this.reportContent = res.content;
            this.reportLoading = false;
        },
        error: (err) => {
            console.error('Error generating report', err);
            this.reportContent = "Desculpe, não consegui gerar o relatório agora. Tente mais tarde!";
            this.reportLoading = false;
        }
    })
  }

  loadDashboard(m: number, y: number) {
    this.loading.set(true);
    this.dashboardService.getSummary(m, y).subscribe({
      next: (data) => {
        this.summary.set(data);
        this.setupChart(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading dashboard', err);
        this.loading.set(false);
      }
    });

    if (this.subscriptionService.canAccess('cost_of_living')) {
      this.analysisService.getMonthlyAverages().subscribe({
        next: (data) => {
          if (data && data.realized) {
              this.costOfLiving.set(data.realized.average_total);
          }
        },
        error: (err) => console.error('Error fetching cost of living', err)
      });
    }
  }

  setupChart(data: DashboardSummary) {
    // 1. Doughnut Chart (Categories)
    this.chartData = {
      labels: data.expenses_by_category.map(c => c.category_name),
      datasets: [
        {
          label: 'Despesas por Categoria',
          data: data.expenses_by_category.map(c => c.total),
          backgroundColor: data.expenses_by_category.map(c => c.color),
          borderWidth: 0,
          hoverBackgroundColor: data.expenses_by_category.map(c => c.color)
        }
      ]
    };

    // 2. Bar Chart (Evolution)
    if (data.evolution) {
      this.evolutionChartData = {
        labels: data.evolution.map(e => e.month),
        datasets: [
          {
            label: 'Receitas',
            data: data.evolution.map(e => e.income),
            backgroundColor: '#22c55e', // Green
            borderColor: '#22c55e',
            borderWidth: 1
          },
          {
            label: 'Despesas',
            data: data.evolution.map(e => e.expense),
            backgroundColor: '#ef4444', // Red
            borderColor: '#ef4444',
            borderWidth: 1
          }
        ]
      };
    }

    this.initChartOptions(); // Reset options
  }

  initChartOptions() {
    const documentStyle = getComputedStyle(document.documentElement);
    const textColor = documentStyle.getPropertyValue('--text-color');
    const textColorSecondary = documentStyle.getPropertyValue('--text-color-secondary');
    const surfaceBorder = documentStyle.getPropertyValue('--surface-border');

    // Options for Doughnut
    this.chartOptions = {
      cutout: '60%',
      plugins: {
        legend: {
          display: true, // Display legend for doughnut
          labels: {
            usePointStyle: true,
            color: textColor
          }
        }
      },
      maintainAspectRatio: false,
      responsive: true
    };

    // Options for Evolution Bar Chart
    this.evolutionChartOptions = {
      maintainAspectRatio: false,
      responsive: true,
      plugins: {
        legend: {
          labels: {
            usePointStyle: true,
            color: textColor
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: textColorSecondary
          },
          grid: {
            color: surfaceBorder,
            drawBorder: false
          }
        },
        y: {
          ticks: {
            color: textColorSecondary,
            callback: function (value: any) {
              return 'R$ ' + value;
            }
          },
          grid: {
            color: surfaceBorder,
            drawBorder: false
          }
        }
      }
    };
  }



  getProgressColor(percentage: number): string {
    if (percentage >= 100) return '#ef4444'; // Red (Estourou)
    if (percentage >= 80) return '#f59e0b';  // Amber (Alerta)
    return '#22c55e';                         // Green (Ok)
  }

}
