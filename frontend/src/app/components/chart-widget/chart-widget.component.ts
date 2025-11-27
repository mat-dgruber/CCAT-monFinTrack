import { Component, Input, OnInit, Signal, computed, effect, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartModule } from 'primeng/chart';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { ButtonModule } from 'primeng/button';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { DashboardWidget, DateRangePreset, GroupingOption, ValueFilter, WidgetType } from '../../models/dashboard-widget.model';
import { Transaction } from '../../models/transaction.model';
import { CategoryType } from '../../models/category.model';
import { TransactionService } from '../../services/transaction.service';

@Component({
  selector: 'app-chart-widget',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ChartModule,
    SelectModule,
    DatePickerModule,
    ButtonModule,
    ToggleButtonModule
  ],
  template: `
    <div class="bg-white rounded-lg shadow-md p-4 flex flex-col h-full relative">
      <!-- Toolbar -->
      <div class="flex flex-wrap gap-2 mb-4 items-center justify-between border-b pb-2">
        <div class="flex flex-wrap gap-2 items-center">
            <!-- Chart Type -->
             <p-select
                [options]="chartTypes"
                [(ngModel)]="widgetConfig.type"
                (onChange)="updateChart()"
                optionLabel="label"
                optionValue="value"
                styleClass="w-32"
                size="small"
                variant="filled">
            </p-select>

             <!-- Date Preset -->
             <p-select
                [options]="datePresets"
                [(ngModel)]="widgetConfig.datePreset"
                (onChange)="onDatePresetChange()"
                optionLabel="label"
                optionValue="value"
                styleClass="w-32"
                size="small"
                variant="filled">
            </p-select>

            <!-- Custom Date Range (Visible only if custom) -->
            <p-datepicker
                *ngIf="widgetConfig.datePreset === 'custom'"
                [(ngModel)]="widgetConfig.customDateRange"
                selectionMode="range"
                (onSelect)="updateChart()"
                [readonlyInput]="true"
                placeholder="Selecione Data"
                styleClass="w-48"
                size="small">
            </p-datepicker>
        </div>

        <div class="flex flex-wrap gap-2 items-center">
             <!-- Group By -->
            <p-select
                [options]="groupingOptions"
                [(ngModel)]="widgetConfig.groupBy"
                (onChange)="updateChart()"
                optionLabel="label"
                optionValue="value"
                styleClass="w-32"
                size="small"
                variant="filled">
            </p-select>

            <!-- Summary Toggle -->
            <p-toggleButton
                [(ngModel)]="widgetConfig.showSummary"
                onLabel="Resumo"
                offLabel="Resumo"
                onIcon="pi pi-list"
                offIcon="pi pi-chart-bar"
                styleClass="w-24 text-sm">
            </p-toggleButton>

            <!-- Delete Button -->
             <button pButton icon="pi pi-trash" class="p-button-text p-button-danger p-button-sm p-0 w-8 h-8" (click)="onRemoveWidget()"></button>
        </div>
      </div>

      <!-- Chart Area -->
      <div class="flex-grow relative min-h-[300px]" [class.hidden]="widgetConfig.showSummary">
        <p-chart [type]="widgetConfig.type" [data]="chartData" [options]="chartOptions" height="300px"></p-chart>
      </div>

      <!-- Summary Area -->
      <div *ngIf="widgetConfig.showSummary" class="flex-grow flex flex-col gap-4 p-4 overflow-auto min-h-[300px] bg-gray-50 rounded">
         <div class="grid grid-cols-2 gap-4">
             <div class="bg-white p-3 rounded shadow-sm border text-center">
                 <div class="text-sm text-gray-500">Transações</div>
                 <div class="text-xl font-bold">{{ summaryStats.count }}</div>
             </div>
             <div class="bg-white p-3 rounded shadow-sm border text-center">
                 <div class="text-sm text-gray-500">Valor Total</div>
                 <div class="text-xl font-bold">{{ summaryStats.total | currency }}</div>
             </div>
             <div class="bg-white p-3 rounded shadow-sm border text-center">
                 <div class="text-sm text-gray-500">Média</div>
                 <div class="text-xl font-bold">{{ summaryStats.average | currency }}</div>
             </div>
         </div>
         <div class="text-sm text-gray-600 mt-2">
            <p><strong>Intervalo:</strong> {{ summaryStats.firstDate | date:'mediumDate' }} - {{ summaryStats.lastDate | date:'mediumDate' }}</p>
         </div>

         <div class="mt-4">
            <h4 class="font-semibold mb-2 text-sm">Top Segmentos</h4>
             <ul class="text-sm space-y-1">
                 <li *ngFor="let item of summaryStats.topSegments" class="flex justify-between border-b border-dashed pb-1">
                     <span>{{ item.label }}</span>
                     <span class="font-medium">{{ item.value | currency }}</span>
                 </li>
             </ul>
         </div>
      </div>
    </div>
  `
})
export class ChartWidgetComponent implements OnInit {
  @Input() widgetConfig!: DashboardWidget;
  @Input() removeCallback!: (id: string) => void;

  private transactionService = inject(TransactionService);

  chartData: any;
  chartOptions: any;
  summaryStats: any = {
      count: 0,
      total: 0,
      average: 0,
      firstDate: null,
      lastDate: null,
      topSegments: []
  };

  chartTypes = [
    { label: 'Pizza', value: 'pie' },
    { label: 'Rosca', value: 'doughnut' },
    { label: 'Barras', value: 'bar' },
    { label: 'Linha', value: 'line' }
  ];

  datePresets = [
      { label: 'Esse Mês', value: 'this-month' },
      { label: 'Mês Passado', value: 'last-month' },
      { label: 'Esse Ano', value: 'this-year' },
      { label: 'Essa Semana', value: 'this-week' },
      { label: 'Customizado', value: 'custom' }
  ];

  groupingOptions = [
      { label: 'Categoria', value: 'category' },
      { label: 'Subcategoria', value: 'subcategory' },
      { label: 'Forma de Pagamento', value: 'payment-method' },
      { label: 'Data', value: 'date' }
  ];

  private allTransactions: Transaction[] = [];

  ngOnInit() {
      // Get all transactions first (for now, client-side filtering is easier for dynamic widgets)
      // Ideally backend would support aggregation, but existing service returns list.
      // We will fetch enough history or let the backend filter if optimized.
      // For now, let's fetch 'this year' by default or all.
      // Since we support 'This Year' as preset, fetching a wide range is safer if we do client side filtering.
      // However, to keep it performant, maybe fetch based on preset?
      // But if user changes preset, we need to refetch.
      // Let's implement a fetch method.

      this.fetchData();
  }

  fetchData() {
      // Logic to determine date range for API call based on preset
      // If we want to support switching presets without refetching ALL data every time, we might cache.
      // But simpler is to fetch what is needed.

      // However, the previous implementation did client-side filtering on a "pool".
      // Let's fetch all transactions for the relevant period.
      // Since the API supports start_date and end_date, we can use that.

      const { start, end } = this.calculateDateRange();

      this.transactionService.getTransactions(undefined, undefined, undefined, start?.toISOString(), end?.toISOString())
          .subscribe({
              next: (data) => {
                  this.allTransactions = data;
                  this.updateChartDataLocal();
              },
              error: (err) => console.error(err)
          });
  }

  onRemoveWidget() {
      if (this.removeCallback) {
          this.removeCallback(this.widgetConfig.id);
      }
  }

  onDatePresetChange() {
      if (this.widgetConfig.datePreset !== 'custom') {
          this.widgetConfig.customDateRange = undefined;
          this.fetchData(); // Refetch data for new range
      }
  }

  updateChart() {
      // If custom date range changes, we might need to refetch
      if (this.widgetConfig.datePreset === 'custom') {
           this.fetchData();
      } else {
           this.updateChartDataLocal();
      }
  }

  private updateChartDataLocal() {
       // Filter (already filtered by API mostly, but double check)
       // Group
       const groupedData = this.groupData(this.allTransactions);

       // Stats
       this.calculateStats(this.allTransactions, groupedData);

       // Chart
       this.chartData = this.generateChartData(groupedData);
       this.chartOptions = this.getChartOptions();
  }

  private calculateDateRange(): { start?: Date, end?: Date } {
      const now = new Date();
      let startDate: Date | undefined;
      let endDate: Date | undefined = now;

      switch (this.widgetConfig.datePreset) {
          case 'this-month':
              startDate = new Date(now.getFullYear(), now.getMonth(), 1);
              break;
          case 'last-month':
              startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
              endDate = new Date(now.getFullYear(), now.getMonth(), 0);
              break;
          case 'this-year':
              startDate = new Date(now.getFullYear(), 0, 1);
              break;
          case 'this-week':
              const day = now.getDay();
              const diff = now.getDate() - day + (day === 0 ? -6 : 1);
              startDate = new Date(now.setDate(diff));
              startDate.setHours(0,0,0,0);
              break;
          case 'custom':
              if (this.widgetConfig.customDateRange && this.widgetConfig.customDateRange[0]) {
                  startDate = this.widgetConfig.customDateRange[0];
                  endDate = this.widgetConfig.customDateRange[1] || startDate;
              }
              break;
          default:
              startDate = undefined; // All time
      }
      return { start: startDate, end: endDate };
  }

  private groupData(transactions: Transaction[]): { [key: string]: number } {
      const grouped: { [key: string]: number } = {};

      transactions.forEach(t => {
          // Value Filter
          if (this.widgetConfig.valueFilter === 'income' && t.type !== 'income') return;
          if (this.widgetConfig.valueFilter === 'expense' && t.type !== 'expense') return;

          let key = 'Outros';
          if (this.widgetConfig.groupBy === 'category') {
              key = t.category?.name || 'Sem Categoria';
          } else if (this.widgetConfig.groupBy === 'payment-method') {
              key = t.payment_method;
          } else if (this.widgetConfig.groupBy === 'date') {
             const d = new Date(t.date);
             key = d.toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
          } else if (this.widgetConfig.groupBy === 'subcategory') {
              key = t.description.split(' ')[0]; // Still mock-ish as we don't have real subcategories
          }

          if (!grouped[key]) grouped[key] = 0;
          grouped[key] += t.amount;
      });
      return grouped;
  }

  private calculateStats(transactions: Transaction[], grouped: { [key: string]: number }) {
      this.summaryStats.count = transactions.length;
      this.summaryStats.total = transactions.reduce((acc, t) => acc + t.amount, 0);
      this.summaryStats.average = this.summaryStats.count > 0 ? this.summaryStats.total / this.summaryStats.count : 0;

      if (transactions.length > 0) {
          const dates = transactions.map(t => new Date(t.date).getTime()).sort();
          this.summaryStats.firstDate = new Date(dates[0]);
          this.summaryStats.lastDate = new Date(dates[dates.length - 1]);
      } else {
          this.summaryStats.firstDate = null;
          this.summaryStats.lastDate = null;
      }

      this.summaryStats.topSegments = Object.entries(grouped)
          .map(([key, value]) => ({ label: key, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5);
  }

  private generateChartData(grouped: { [key: string]: number }) {
      const labels = Object.keys(grouped);
      const data = Object.values(grouped);

      const backgroundColors = labels.map(() => '#' + Math.floor(Math.random()*16777215).toString(16));

      return {
          labels: labels,
          datasets: [
              {
                  label: 'Valor',
                  data: data,
                  backgroundColor: this.widgetConfig.type === 'line' ? '#3b82f6' : backgroundColors,
                  borderColor: this.widgetConfig.type === 'line' ? '#3b82f6' : '#ffffff',
                  fill: this.widgetConfig.type !== 'line',
                  tension: 0.4
              }
          ]
      };
  }

  private getChartOptions() {
      return {
          plugins: {
              legend: {
                  position: 'bottom',
                  display: this.widgetConfig.type !== 'bar'
              }
          },
          maintainAspectRatio: false,
          scales: this.widgetConfig.type === 'bar' || this.widgetConfig.type === 'line' ? {
              y: {
                  beginAtZero: true
              }
          } : undefined
      };
  }
}
