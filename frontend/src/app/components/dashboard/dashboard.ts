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


// Services
import { DashboardService, DashboardSummary } from '../../services/dashboard.service';
import { RefreshService } from '../../services/refresh.service';
import { FilterService } from '../../services/filter.service';
import { AccountService } from '../../services/account.service';
import { Account } from '../../models/account.model';

// Components
import { AccountManager } from '../account-manager/account-manager';
import { BudgetManager } from '../budget-manager/budget-manager';
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
    RecentTransactionsComponent,
    SkeletonModule
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {

  private dashboardService = inject(DashboardService);
  private refreshService = inject(RefreshService);
  private filterService = inject(FilterService);
  private accountService = inject(AccountService);


  summary = signal<DashboardSummary | null>(null);
  loading = signal(true);



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
