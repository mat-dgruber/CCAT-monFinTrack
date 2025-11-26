import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// PrimeNG
import { ChartModule } from 'primeng/chart';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';

// Services
import { DashboardService, DashboardSummary } from '../../services/dashboard.service';
import { RefreshService } from '../../services/refresh.service';
import { FilterService } from '../../services/filter.service';

@Component({
  selector: 'app-advanced-charts',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ChartModule,
    SelectModule,
    ButtonModule,
  ],
  templateUrl: './advanced-charts.html',
  styleUrl: './advanced-charts.scss',
})
export class AdvancedCharts implements OnInit {

  private dashboardService = inject(DashboardService);
  private refreshService = inject(RefreshService);
  private filterService = inject(FilterService);

  summary = signal<DashboardSummary | null>(null);

  // Chart
  chartData: any;
  chartOptions: any;
  chartType = signal<'bar' | 'doughnut' | 'line'>('bar');
  chartTypes = [
    { label: 'Barra', value: 'bar' },
    { label: 'Rosca', value: 'doughnut' },
    { label: 'Linha', value: 'line' },
  ];

  // Grouping
  groupBy = signal<'category' | 'payment_method' | 'account'>('category');
  groupByOptions = [
    { label: 'Categoria', value: 'category' },
    { label: 'Forma de Pagamento', value: 'payment_method' },
    { label: 'Conta', value: 'account' },
  ];


  constructor() {
    effect(() => {
      const m = this.filterService.month();
      const y = this.filterService.year();
      this.refreshService.refreshSignal(); // Listen for refresh
      this.loadDashboard(m, y, this.groupBy());
    });
  }

  ngOnInit() {
    this.initChartOptions();
  }

  loadDashboard(m: number, y: number, groupBy: string) {
    this.dashboardService.getSummary(m, y, { groupBy }).subscribe(data => {
      this.summary.set(data);
      this.setupChart(data);
    });
  }

  setupChart(data: DashboardSummary) {
    const type = this.chartType();
    const group = this.groupBy();

    let labels: string[] = [];
    let totals: number[] = [];
    let colors: string[] = [];

    if (group === 'category') {
      labels = data.expenses_by_category.map(c => c.category_name);
      totals = data.expenses_by_category.map(c => c.total);
      colors = data.expenses_by_category.map(c => c.color);
    } else if (group === 'payment_method') {
      labels = data.expenses_by_payment_method?.map(p => p.payment_method_name) || [];
      totals = data.expenses_by_payment_method?.map(p => p.total) || [];
    } else if (group === 'account') {
      labels = data.expenses_by_account?.map(a => a.account_name) || [];
      totals = data.expenses_by_account?.map(a => a.total) || [];
    }

    this.chartData = {
      labels: labels,
      datasets: [
        {
          label: 'Despesas',
          data: totals,
          backgroundColor: type === 'doughnut' ? colors : '#3b82f6',
          borderColor: '#3b82f6',
          hoverBackgroundColor: colors
        }
      ]
    };

    this.initChartOptions(); // Reset options
    if (type === 'bar' || type === 'line') {
      this.chartOptions.scales = {
        y: {
          beginAtZero: true,
          ticks: { color: '#6b7280' },
          grid: { color: '#e5e7eb' }
        },
        x: {
          ticks: { color: '#6b7280' },
          grid: { color: '#e5e7eb' }
        }
      };
    }
  }

  initChartOptions() {
    const type = this.chartType();
    this.chartOptions = {
      cutout: type === 'doughnut' ? '60%' : '0%',
      plugins: {
        legend: {
          display: type !== 'doughnut',
          labels: {
            usePointStyle: true,
            color: '#4b5563'
          }
        }
      },
      maintainAspectRatio: false,
      responsive: true
    };
  }

  onChartTypeChange(type: 'bar' | 'doughnut' | 'line') {
    this.chartType.set(type);
    if (this.summary()) {
      this.setupChart(this.summary()!);
    }
  }

  onGroupByChange(group: 'category' | 'payment_method' | 'account') {
    this.groupBy.set(group);
  }
}
