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


@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    ChartModule,
    CardModule,
    MonthSelector
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

  loadAccounts() {
    this.accountService.getAccounts().subscribe(data => this.accounts.set(data));
  }

  loadDashboard(m: number, y: number) {
    this.dashboardService.getSummary(m, y).subscribe(data => {
      this.summary.set(data);
      this.setupChart(data);
    });
  }

  setupChart(data: DashboardSummary) {
    this.chartData = {
      labels: data.expenses_by_category.map(c => c.category_name),
      datasets: [
        {
          label: 'Despesas por Categoria',
          data: data.expenses_by_category.map(c => c.total),
          backgroundColor: data.expenses_by_category.map(c => c.color),
          borderColor: '#3b82f6',
          hoverBackgroundColor: data.expenses_by_category.map(c => c.color)
        }
      ]
    };

    this.initChartOptions(); // Reset options
  }

  initChartOptions() {
    this.chartOptions = {
      cutout: '60%',
      plugins: {
        legend: {
          display: true, // Display legend for doughnut
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



  getProgressColor(percentage: number): string {
    if (percentage >= 100) return '#ef4444'; // Red (Estourou)
    if (percentage >= 80) return '#f59e0b';  // Amber (Alerta)
    return '#22c55e';                         // Green (Ok)
  }

}

