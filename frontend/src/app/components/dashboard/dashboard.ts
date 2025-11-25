import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup } from '@angular/forms';

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
    SelectModule, // Use SelectModule
    MultiSelectModule, // Use MultiSelectModule
    DatePickerModule,
    ButtonModule,
    TooltipModule
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {

  private dashboardService = inject(DashboardService);
  private refreshService = inject(RefreshService);
  private filterService = inject(FilterService);
  private accountService = inject(AccountService);
  private fb = inject(FormBuilder);

  summary = signal<DashboardSummary | null>(null);

  // Chart
  chartData: any;
  chartOptions: any;
  chartType = signal<'doughnut' | 'bar' | 'line'>('doughnut');
  chartTypes = [
    { label: 'Rosca', value: 'doughnut' },
    { label: 'Barra', value: 'bar' },
    { label: 'Linha', value: 'line' },
  ];

  showFilters = signal(false);

  // Filters
  accounts = signal<Account[]>([]);
  paymentMethods = [
    { label: 'Cartão de Crédito', value: 'credit_card' },
    { label: 'Débito', value: 'debit_card' },
    { label: 'Pix', value: 'pix' },
    { label: 'Dinheiro', value: 'cash' }
  ];

  filterForm: FormGroup;


  constructor() {
    this.filterForm = this.fb.group({
      accounts: [[]],
      paymentMethods: [[]],
      dateRange: [[]]
    });

    // Efeito para recarregar os dados do dashboard quando o sinal de refresh for acionado
    effect(() => {
      const m = this.filterService.month();
      const y = this.filterService.year();
      this.refreshService.refreshSignal();
      this.loadDashboard(m, y, this.filterForm.value);
    });

    this.filterForm.valueChanges.subscribe(filters => {
        const m = this.filterService.month();
        const y = this.filterService.year();
        this.loadDashboard(m, y, filters);
    });
  }

  ngOnInit() {
    this.initChartOptions();
    this.loadAccounts();
  }

  loadAccounts() {
    this.accountService.getAccounts().subscribe(data => this.accounts.set(data));
  }

  loadDashboard(m: number, y: number, filters?: any) {
    this.dashboardService.getSummary(m, y, filters).subscribe(data => {
      this.summary.set(data);
      this.setupChart(data);
    });
  }

  setupChart(data: DashboardSummary) {
    const type = this.chartType();
    
    this.chartData = {
      labels: data.expenses_by_category.map(c => c.category_name),
      datasets: [
        {
          label: 'Despesas por Categoria',
          data: data.expenses_by_category.map(c => c.total),
          backgroundColor: type === 'doughnut' ? data.expenses_by_category.map(c => c.color) : '#3b82f6',
          borderColor: '#3b82f6',
          hoverBackgroundColor: data.expenses_by_category.map(c => c.color)
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

  onChartTypeChange(event: any) {
    this.chartType.set(event.value);
    if (this.summary()) {
      this.setupChart(this.summary()!);
    }
  }

  getProgressColor(percentage: number): string {
    if (percentage >= 100) return '#ef4444'; // Red (Estourou)
    if (percentage >= 80) return '#f59e0b';  // Amber (Alerta)
    return '#22c55e';                         // Green (Ok)
  }

}
