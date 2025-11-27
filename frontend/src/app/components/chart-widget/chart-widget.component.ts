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
import { Category } from '../../models/category.model';
import { TransactionService } from '../../services/transaction.service';
import { CategoryService } from '../../services/category.service';

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
             <!-- Value Filter (Income/Expense/Both) -->
             <p-select
                [options]="valueFilterOptions"
                [(ngModel)]="widgetConfig.valueFilter"
                (onChange)="updateChart()"
                optionLabel="label"
                optionValue="value"
                styleClass="w-32"
                size="small"
                variant="filled">
            </p-select>

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
      <div *ngIf="widgetConfig.showSummary" class="flex-grow flex flex-col gap-6 p-4 overflow-auto min-h-[300px] bg-white rounded">
        <!-- Summary Cards (Parity with Transaction Manager) -->
        <div class="space-y-4">
            <div class="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div class="text-sm text-gray-500 mb-1">Total de Transações</div>
                <div class="text-2xl font-bold text-gray-900">{{summaryStats.totalTransactions}}</div>
            </div>

            <div class="p-4 bg-red-50 rounded-xl border border-red-100">
                <div class="text-sm text-red-600 mb-1">Total Despesas</div>
                <div class="text-2xl font-bold text-red-700">{{summaryStats.totalExpense | currency:'BRL'}}</div>
            </div>

            <div class="p-4 bg-green-50 rounded-xl border border-green-100">
                <div class="text-sm text-green-600 mb-1">Total Receitas</div>
                <div class="text-2xl font-bold text-green-700">{{summaryStats.totalIncome | currency:'BRL'}}</div>
            </div>

            <div class="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div class="text-sm text-blue-600 mb-1">Saldo do Período</div>
                <div class="text-2xl font-bold text-blue-700">{{summaryStats.net | currency:'BRL'}}</div>
            </div>

            <div class="border-t border-gray-100 my-2"></div>

            <div class="space-y-3">
                <div class="flex justify-between items-center text-sm">
                    <span class="text-gray-500">Maior Despesa</span>
                    <span class="font-medium text-gray-900">{{summaryStats.maxExpense | currency:'BRL'}}</span>
                </div>
                <div class="flex justify-between items-center text-sm">
                    <span class="text-gray-500">Média (Valor)</span>
                    <span class="font-medium text-gray-900">{{summaryStats.avgTx | currency:'BRL'}}</span>
                </div>
                <div class="flex justify-between items-center text-sm">
                    <span class="text-gray-500">Primeira Data</span>
                    <span class="font-medium text-gray-900">{{summaryStats.firstDate | date:'dd/MM/yy'}}</span>
                </div>
                    <div class="flex justify-between items-center text-sm">
                    <span class="text-gray-500">Última Data</span>
                    <span class="font-medium text-gray-900">{{summaryStats.lastDate | date:'dd/MM/yy'}}</span>
                </div>
            </div>
        </div>
      </div>
    </div>
  `
})
export class ChartWidgetComponent implements OnInit {
  @Input() widgetConfig!: DashboardWidget;
  @Input() removeCallback!: (id: string) => void;

  private transactionService = inject(TransactionService);
  private categoryService = inject(CategoryService);

  chartData: any;
  chartOptions: any;
  
  // Summary Stats matching TransactionManager
  summaryStats: any = {
    totalTransactions: 0,
    totalIncome: 0,
    totalExpense: 0,
    net: 0,
    maxTx: 0,
    maxExpense: 0,
    avgTx: 0,
    firstDate: null,
    lastDate: null
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

  valueFilterOptions = [
      { label: 'Ambos', value: 'both' },
      { label: 'Receitas', value: 'income' },
      { label: 'Despesas', value: 'expense' }
  ];

  // Palette for deterministic colors
  private colorPalette = [
    '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', 
    '#06b6d4', '#10b981', '#f97316', '#6366f1', '#14b8a6', '#d946ef',
    '#84cc16', '#eab308', '#a855f7', '#0ea5e9', '#f43f5e', '#64748b'
  ];

  private allTransactions: Transaction[] = [];
  private categoryMap = new Map<string, Category>();

  ngOnInit() {
      // Load categories for hierarchy resolution
      this.categoryService.getCategories().subscribe(cats => {
          this.buildCategoryMap(cats);
          this.fetchData();
      });
  }

  buildCategoryMap(categories: Category[]) {
      categories.forEach(cat => {
          if (cat.id) this.categoryMap.set(cat.id, cat);
          if (cat.subcategories) {
              cat.subcategories.forEach(sub => {
                  if (sub.id) this.categoryMap.set(sub.id, { ...sub, parent_id: cat.id }); // Flatten for lookup, ensuring parent link
              });
          }
      });
  }

  fetchData() {
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
          this.fetchData();
      }
  }

  updateChart() {
      if (this.widgetConfig.datePreset === 'custom') {
           this.fetchData();
      } else {
           this.updateChartDataLocal();
      }
  }

  private updateChartDataLocal() {
       // Filter based on ValueFilter
       const filteredTransactions = this.allTransactions.filter(t => {
           if (this.widgetConfig.valueFilter === 'income' && t.type !== 'income') return false;
           if (this.widgetConfig.valueFilter === 'expense' && t.type !== 'expense') return false;
           return true;
       });

       // Group
       const groupedData = this.groupData(filteredTransactions);

       // Stats (using filtered transactions)
       this.calculateStats(filteredTransactions);

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
      
      const paymentMap: Record<string, string> = {
        'credit_card': 'Cartão de Crédito',
        'debit_card': 'Débito',
        'pix': 'Pix',
        'cash': 'Dinheiro',
        'bank_transfer': 'Transferência',
        'other': 'Outros'
      };

      transactions.forEach(t => {
          let key = 'Outros';
          
          if (this.widgetConfig.groupBy === 'category') {
              // PARENT Logic: Try to find parent
              const catId = t.category_id || t.category?.id;
              if (catId && this.categoryMap.has(catId)) {
                  const cat = this.categoryMap.get(catId)!;
                  if (cat.parent_id && this.categoryMap.has(cat.parent_id)) {
                      key = this.categoryMap.get(cat.parent_id)!.name;
                  } else {
                      key = cat.name;
                  }
              } else {
                  key = t.category?.name || 'Sem Categoria';
              }

          } else if (this.widgetConfig.groupBy === 'subcategory') {
              key = t.category?.name || 'Sem Categoria';

          } else if (this.widgetConfig.groupBy === 'payment-method') {
              const raw = t.payment_method;
              key = paymentMap[raw] || raw;
          } else if (this.widgetConfig.groupBy === 'date') {
             const d = new Date(t.date);
             key = d.toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
          }

          if (!grouped[key]) grouped[key] = 0;
          grouped[key] += t.amount;
      });
      return grouped;
  }

  private calculateStats(list: Transaction[]) {
    const totalTransactions = list.length;
    let totalIncome = 0;
    let totalExpense = 0;
    let maxTx = 0;
    let maxExpense = 0;
    let minDate = new Date();
    let maxDate = new Date(0);

    for (const t of list) {
        const amount = t.amount;
        if (t.type === 'income') totalIncome += amount;
        else totalExpense += amount;

        if (amount > maxTx) maxTx = amount;
        if (t.type === 'expense' && amount > maxExpense) maxExpense = amount;

        const d = new Date(t.date);
        if (d < minDate) minDate = d;
        if (d > maxDate) maxDate = d;
    }

    const net = totalIncome - totalExpense;
    const avg = list.length > 0 ? (totalIncome + totalExpense) / list.length : 0;

    this.summaryStats = {
        totalTransactions,
        totalIncome,
        totalExpense,
        net,
        maxTx,
        maxExpense,
        avgTx: avg,
        firstDate: list.length > 0 ? minDate : null,
        lastDate: list.length > 0 ? maxDate : null
    };
  }

  private generateChartData(grouped: { [key: string]: number }) {
      const labels = Object.keys(grouped);
      const data = Object.values(grouped);

      // Deterministic Colors
      const backgroundColors = labels.map(label => this.getColorForLabel(label));

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

  private getColorForLabel(label: string): string {
    let hash = 0;
    for (let i = 0; i < label.length; i++) {
        hash = label.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash % this.colorPalette.length);
    return this.colorPalette[index];
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