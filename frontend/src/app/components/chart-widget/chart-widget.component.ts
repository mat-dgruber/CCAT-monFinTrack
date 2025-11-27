import { Component, Input, OnInit, Signal, computed, effect, signal, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartModule } from 'primeng/chart';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { ButtonModule } from 'primeng/button';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { TooltipModule } from 'primeng/tooltip'; // Import Tooltip
import { DashboardWidget, DateRangePreset, GroupingOption, ValueFilter, WidgetType } from '../../models/dashboard-widget.model';
import { Transaction } from '../../models/transaction.model';
import { Category } from '../../models/category.model';
import { TransactionService } from '../../services/transaction.service';
import { CategoryService } from '../../services/category.service';

interface TreemapNode {
    label: string;
    value: number;
    formattedValue: string;
    color: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

interface BoxPlotItem {
    label: string;
    min: number;
    q1: number;
    median: number;
    q3: number;
    max: number;
    color: string;
}

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
    ToggleButtonModule,
    TooltipModule
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
                styleClass="w-48"
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

             <!-- Group By (Hidden for Heatmap/Treemap) -->
            <p-select
                *ngIf="widgetConfig.type !== 'heatmap' && widgetConfig.type !== 'treemap'"
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
      <div class="flex-grow relative min-h-[300px] overflow-hidden" [class.hidden]="widgetConfig.showSummary">
        <!-- Standard Charts -->
        <p-chart *ngIf="widgetConfig.type !== 'heatmap' && widgetConfig.type !== 'treemap' && widgetConfig.type !== 'boxplot'" [type]="widgetConfig.type" [data]="chartData" [options]="chartOptions" height="300px"></p-chart>
        
        <!-- Heatmap (Disabled) -->
        <!-- <div *ngIf="widgetConfig.type === 'heatmap'">...</div> -->

        <!-- Treemap v1.0 -->
        <div *ngIf="widgetConfig.type === 'treemap'" class="relative w-full h-[300px] bg-gray-50 rounded overflow-hidden">
            <div *ngFor="let node of treemapData"
                 class="absolute border border-white flex flex-col items-center justify-center text-center p-1 transition-all hover:brightness-110 cursor-pointer"
                 [style.left.%]="node.x"
                 [style.top.%]="node.y"
                 [style.width.%]="node.w"
                 [style.height.%]="node.h"
                 [style.backgroundColor]="node.color"
                 [pTooltip]="node.label + ': ' + node.formattedValue"
                 tooltipPosition="top">
                 
                 <span class="text-white font-bold text-xs md:text-sm truncate w-full px-1 drop-shadow-md">{{ node.label }}</span>
                 <span *ngIf="node.h > 15" class="text-white text-[10px] opacity-90 drop-shadow-md">{{ node.formattedValue }}</span>
            </div>
            
            <div *ngIf="treemapData.length === 0" class="flex items-center justify-center h-full text-gray-400">
                Sem dados para exibir.
            </div>
        </div>

        <!-- Box Plot v1.0 -->
        <div *ngIf="widgetConfig.type === 'boxplot'" class="w-full h-full flex flex-col overflow-y-auto pr-2">
            <div *ngFor="let item of boxPlotData" class="flex items-center mb-4 h-12 group">
                <!-- Label -->
                <div class="w-32 text-xs text-gray-600 font-medium truncate text-right pr-3" [title]="item.label">
                    {{ item.label }}
                </div>
                
                <!-- Plot Area -->
                <div class="flex-grow relative h-full bg-gray-50 rounded border-l border-gray-200">
                    <!-- Whisker Line (Min to Max) -->
                    <div class="absolute top-1/2 h-[2px] bg-gray-300 -translate-y-1/2"
                         [style.left.%]="getBoxPlotPercent(item.min)"
                         [style.width.%]="getBoxPlotPercent(item.max - item.min)">
                    </div>
                    
                    <!-- Whisker Caps -->
                    <div class="absolute top-1/2 h-3 w-[2px] bg-gray-400 -translate-y-1/2" [style.left.%]="getBoxPlotPercent(item.min)"></div>
                    <div class="absolute top-1/2 h-3 w-[2px] bg-gray-400 -translate-y-1/2" [style.left.%]="getBoxPlotPercent(item.max)"></div>

                    <!-- Box (Q1 to Q3) -->
                    <div class="absolute top-1/2 h-6 -translate-y-1/2 border border-gray-400 opacity-80 hover:opacity-100 transition-opacity"
                         [style.backgroundColor]="item.color"
                         [style.left.%]="getBoxPlotPercent(item.q1)"
                         [style.width.%]="getBoxPlotPercent(item.q3 - item.q1)"
                         [pTooltip]="'Min: ' + (item.min | currency) + '\nQ1: ' + (item.q1 | currency) + '\nMediana: ' + (item.median | currency) + '\nQ3: ' + (item.q3 | currency) + '\nMax: ' + (item.max | currency)"
                         tooltipPosition="top">
                    </div>

                    <!-- Median Line -->
                    <div class="absolute top-1/2 h-6 w-[3px] bg-white -translate-y-1/2 z-10"
                         [style.left.%]="getBoxPlotPercent(item.median)">
                    </div>
                </div>
            </div>
             <div *ngIf="boxPlotData.length === 0" class="flex items-center justify-center h-full text-gray-400">
                Sem dados suficientes para distribuição.
            </div>
        </div>
      </div>

      <!-- Summary Area -->
      <div *ngIf="widgetConfig.showSummary" class="flex-grow flex flex-col gap-6 p-4 overflow-auto min-h-[300px] bg-white rounded">
        <!-- Summary Cards -->
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
  
  // Treemap Data
  treemapData: TreemapNode[] = [];

  // Box Plot Data
  boxPlotData: BoxPlotItem[] = [];
  boxPlotGlobalMax = 0;

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
    { label: 'Linha', value: 'line' },
    { label: 'Treemap (Categorias)', value: 'treemap' },
    { label: 'Box Plot (Distribuição)', value: 'boxplot' }
    // { label: 'Heatmap (Calendário)', value: 'heatmap' } // Disabled
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

  trackByDate(index: number, cell: any): string {
    return cell.date;
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

       // Calculate Stats
       this.calculateStats(filteredTransactions);

       if (this.widgetConfig.type === 'treemap') {
           this.generateTreemapData(filteredTransactions);
       } else if (this.widgetConfig.type === 'boxplot') {
           this.generateBoxPlotData(filteredTransactions);
       } else if (this.widgetConfig.type === 'heatmap') {
           // this.generateHeatmapData(filteredTransactions); // Disabled
       } else {
           // Group
           const groupedData = this.groupData(filteredTransactions);
           // Chart
           this.chartData = this.generateChartData(groupedData);
           this.chartOptions = this.getChartOptions();
       }
  }

  // --- BOX PLOT LOGIC ---
  private generateBoxPlotData(transactions: Transaction[]) {
      const groups: { [key: string]: number[] } = {};
      let globalMax = 0;

      // 1. Group amounts
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
          } else if (this.widgetConfig.groupBy === 'payment-method') {
              key = paymentMap[t.payment_method] || t.payment_method;
          } else if (this.widgetConfig.groupBy === 'subcategory') {
              key = t.category?.name || 'Sem Categoria';
          }

          if (!groups[key]) groups[key] = [];
          groups[key].push(t.amount);
          if (t.amount > globalMax) globalMax = t.amount;
      });

      this.boxPlotGlobalMax = globalMax > 0 ? globalMax : 100; // Avoid division by zero

      // 2. Calculate Stats for each group
      this.boxPlotData = Object.keys(groups).map(key => {
          const values = groups[key].sort((a, b) => a - b);
          const min = values[0];
          const max = values[values.length - 1];
          const q1 = this.getPercentile(values, 25);
          const median = this.getPercentile(values, 50);
          const q3 = this.getPercentile(values, 75);

          return {
              label: key,
              min,
              q1,
              median,
              q3,
              max,
              color: this.getColorForLabel(key)
          };
      }).sort((a, b) => b.median - a.median); // Sort by median descending
  }

  getBoxPlotPercent(value: number): number {
      return (value / this.boxPlotGlobalMax) * 100;
  }

  private getPercentile(data: number[], percentile: number): number {
      if (data.length === 0) return 0;
      const index = (percentile / 100) * (data.length - 1);
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      const weight = index - lower;
      if (upper >= data.length) return data[lower];
      return data[lower] * (1 - weight) + data[upper] * weight;
  }

  // --- TREEMAP LOGIC (Slice-and-Dice Algorithm) ---
  private generateTreemapData(transactions: Transaction[]) {
      // 1. Group by Category (Parent)
      const groups: { [key: string]: number } = {};
      let totalValue = 0;

      transactions.forEach(t => {
          let key = 'Outros';
          // Logic matches groupData for 'category'
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
          
          if (!groups[key]) groups[key] = 0;
          groups[key] += t.amount;
          totalValue += t.amount;
      });

      // 2. Convert to Array and Sort
      let items = Object.entries(groups).map(([label, value]) => ({
          label,
          value,
          percentage: value / totalValue
      })).sort((a, b) => b.value - a.value);

      // 3. Calculate Rectangles (Simple Slice-and-Dice Recursion)
      this.treemapData = [];
      this.layoutTreemap(items, 0, 0, 100, 100, 0);
  }

  private layoutTreemap(items: any[], x: number, y: number, w: number, h: number, depth: number) {
      if (items.length === 0) return;

      if (items.length === 1) {
          const item = items[0];
          this.treemapData.push({
              label: item.label,
              value: item.value,
              formattedValue: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.value),
              color: this.getColorForLabel(item.label),
              x, y, w, h
          });
          return;
      }

      // Determine split direction based on depth (Vertical vs Horizontal) or Aspect Ratio
      // Simple approach: Alternate. Even depth = Vertical Split (vary X), Odd = Horizontal (vary Y).
      const isVertical = w > h; // Split along the longer axis usually better

      // Split items into two halves based on value
      let total = items.reduce((acc, i) => acc + i.value, 0);
      let half = total / 2;
      let acc = 0;
      let midIndex = 0;
      
      for (let i = 0; i < items.length; i++) {
          acc += items[i].value;
          if (acc >= half) {
              midIndex = i + 1; // Include this item in first half
              break;
          }
      }
      if (midIndex >= items.length) midIndex = items.length - 1; // Ensure at least one item in second half if possible
      if (midIndex === 0) midIndex = 1; // Ensure at least one item in first half

      const firstHalf = items.slice(0, midIndex);
      const secondHalf = items.slice(midIndex);

      const firstTotal = firstHalf.reduce((sum, i) => sum + i.value, 0);
      const firstPercent = firstTotal / total;

      if (isVertical) {
          // Split Width
          const w1 = w * firstPercent;
          const w2 = w - w1;
          this.layoutTreemap(firstHalf, x, y, w1, h, depth + 1);
          this.layoutTreemap(secondHalf, x + w1, y, w2, h, depth + 1);
      } else {
          // Split Height
          const h1 = h * firstPercent;
          const h2 = h - h1;
          this.layoutTreemap(firstHalf, x, y, w, h1, depth + 1);
          this.layoutTreemap(secondHalf, x, y + h1, w, h2, depth + 1);
      }
  }
  // --------------------------------------------

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
              // Start on Sunday (0)
              const today = new Date();
              const dayOfWeek = today.getDay(); // 0 for Sunday
              startDate = new Date(today);
              startDate.setDate(today.getDate() - dayOfWeek);
              startDate.setHours(0,0,0,0);

              endDate = new Date(startDate);
              endDate.setDate(startDate.getDate() + 6); // End on Saturday
              endDate.setHours(23,59,59,999);
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
