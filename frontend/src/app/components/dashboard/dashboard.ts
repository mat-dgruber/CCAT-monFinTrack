import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MonthSelector } from '../month-selector/month-selector';

// PrimeNG
import { ChartModule } from 'primeng/chart';
import { CardModule } from 'primeng/card';

// Services
import { DashboardService, DashboardSummary } from '../../services/dashboard.service';
import { RefreshService } from '../../services/refresh.service';
import { FilterService } from '../../services/filter.service';


@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ChartModule, CardModule, MonthSelector],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {

  private dashboardService = inject(DashboardService);
  private refreshService = inject(RefreshService);
  private filterService = inject(FilterService);

  summary = signal<DashboardSummary | null>(null);

  // Configurações do Gráfico
  chartData: any;
  chartOptions: any;

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
    // this.loadDashboard(); // Effect já chama
  }

  loadDashboard(m: number, y: number) {
    this.dashboardService.getSummary(m, y).subscribe(data => {
      this.summary.set(data);
      this.setupChart(data);
    });
  }

  setupChart(data: DashboardSummary) {
    // Prepara os dados para o Gráfico de Rosca (Doughnut)
    this.chartData = {
      labels: data.expenses_by_category.map(c => c.category_name),
      datasets: [
        {
          data: data.expenses_by_category.map(c => c.total),
          backgroundColor: data.expenses_by_category.map(c => c.color),
          hoverBackgroundColor: data.expenses_by_category.map(c => c.color)
        }
      ]
    };
  }

  initChartOptions() {
    this.chartOptions = {
      cutout: '60%', // Tamanho do buraco da rosca
      plugins: {
        legend: {
          labels: {
            usePointStyle: true,
            color: '#4b5563'
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
