import { Component, Input, OnInit, Signal, computed, effect, signal, inject, ViewChild, ElementRef, Output, EventEmitter } from '@angular/core';
import { forkJoin } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartModule } from 'primeng/chart';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { ButtonModule } from 'primeng/button';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { TooltipModule } from 'primeng/tooltip';
import { PopoverModule } from 'primeng/popover';
import { SkeletonModule } from 'primeng/skeleton';
import { DashboardWidget, DateRangePreset, GroupingOption, ValueFilter, WidgetType } from '../../models/dashboard-widget.model';
import { Transaction } from '../../models/transaction.model';
import { Category } from '../../models/category.model';
import { TransactionService } from '../../services/transaction.service';
import { CategoryService } from '../../services/category.service';
import { ColorService } from '../../services/color.service';
import html2canvas from 'html2canvas';

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

interface SankeyNode {
    id: string;
    name: string;
    column: number;
    value: number;
    x: number;
    y: number;
    w: number;
    h: number;
    color: string;
}

interface SankeyLink {
    source: string;
    target: string;
    value: number;
    width: number;
    d: string; // SVG path
    color: string;
    gradientId?: string;
    sourceColor?: string;
    targetColor?: string;
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
        ButtonModule,
        ToggleButtonModule,
        TooltipModule,
        PopoverModule,
        SkeletonModule
    ],
    template: `
    <div class="bg-white dark:bg-slate-800 rounded-lg shadow-md dark:shadow-none dark:border dark:border-gray-700 p-4 flex flex-col h-full relative transition-all hover:shadow-lg">
      <!-- Toolbar -->
      <div class="flex flex-wrap gap-2 mb-2 items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
        <div class="flex flex-wrap gap-2 items-center">
             <!-- Title (Optional) or Type Icon -->
             <div class="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                <i class="pi" [ngClass]="{
                    'pi-chart-pie': widgetConfig.type === 'pie' || widgetConfig.type === 'doughnut',
                    'pi-chart-bar': widgetConfig.type === 'bar',
                    'pi-chart-line': widgetConfig.type === 'line',
                    'pi-th-large': widgetConfig.type === 'treemap',
                    'pi-box': widgetConfig.type === 'boxplot',
                    'pi-share-alt': widgetConfig.type === 'sankey'
                }"></i>
                <span *ngIf="widgetConfig.title">{{ widgetConfig.title }}</span>
                <span *ngIf="!widgetConfig.title" class="text-sm text-gray-500 dark:text-gray-400 capitalize">{{ getChartLabel(widgetConfig.type) }}</span>
             </div>
        </div>

        <div class="flex flex-wrap gap-1 items-center">
            <!-- Resize Button -->
            <button pButton
                    [icon]="widgetConfig.colSpan === 2 ? 'pi pi-window-minimize' : 'pi pi-window-maximize'"
                    class="p-button-text p-button-secondary p-button-sm p-0 w-8 h-8"
                    (click)="onResizeWidget()"
                    pTooltip="Expandir/Reduzir">
            </button>

            <!-- Export Button -->
            <button pButton icon="pi pi-image" class="p-button-text p-button-secondary p-button-sm p-0 w-8 h-8" (click)="exportChart()" pTooltip="Exportar Imagem"></button>

            <!-- Settings Button -->
            <button pButton icon="pi pi-cog" class="p-button-text p-button-secondary p-button-sm p-0 w-8 h-8" (click)="op.toggle($event)" pTooltip="Configurações"></button>
            <p-popover #op styleClass="dark:bg-slate-800 dark:border-slate-800">
                <div class="flex flex-col gap-4 w-72 p-1 dark:bg-slate-800 dark:text-gray-200 dark:shadow-none dark:border-slate-800">
                    <span class="font-semibold text-sm text-gray-700 dark:bg-slate-800 dark:text-gray-200 dark:shadow-none dark:border-slate-800 border-b pb-1">Configuração do Gráfico</span>

                    <!-- Filters moved here -->
                    <div class="flex flex-col gap-2">
                        <label class="text-xs text-gray-500 dark:text-gray-400 dark:border-slate-800">Tipo de Gráfico</label>
                        <p-select [options]="chartTypes" [(ngModel)]="widgetConfig.type" (onChange)="updateChart()" optionLabel="label" optionValue="value" size="small" styleClass="w-full" appendTo="body" panelStyleClass="dark:bg-slate-800 dark:border-gray-700"></p-select>
                    </div>

                    <div class="flex flex-col gap-2">
                        <label class="text-xs text-gray-500 dark:text-gray-400 dark:border-slate-800">Período</label>
                        <p-select [options]="datePresets" [(ngModel)]="widgetConfig.datePreset" (onChange)="onDatePresetChange()" optionLabel="label" optionValue="value" size="small" styleClass="w-full" appendTo="body" panelStyleClass="dark:bg-slate-800 dark:border-gray-700"></p-select>
                    </div>

                    <div class="flex flex-col gap-2" *ngIf="widgetConfig.datePreset === 'custom'">
                        <label class="text-xs text-gray-500 dark:text-gray-400 dark:border-slate-800">Data Personalizada</label>
                        <p-datepicker [(ngModel)]="widgetConfig.customDateRange" selectionMode="range" (onSelect)="updateChart()" [readonlyInput]="true" placeholder="Selecione Data" size="small" styleClass="w-full"></p-datepicker>
                    </div>

                    <div class="flex flex-col gap-2">
                        <label class="text-xs text-gray-500 dark:text-gray-400 dark:border-slate-800">Filtrar Valor</label>
                        <p-select [options]="valueFilterOptions" [(ngModel)]="widgetConfig.valueFilter" (onChange)="updateChart()" optionLabel="label" optionValue="value" size="small" styleClass="w-full" appendTo="body" panelStyleClass="dark:bg-slate-800 dark:border-gray-700"></p-select>
                    </div>

                    <div class="flex flex-col gap-2" *ngIf="widgetConfig.type !== 'heatmap' && widgetConfig.type !== 'treemap' && widgetConfig.type !== 'sankey'">
                        <label class="text-xs text-gray-500 dark:text-gray-400 dark:border-slate-800">Agrupar Por</label>
                        <p-select [options]="groupingOptions" [(ngModel)]="widgetConfig.groupBy" (onChange)="updateChart()" optionLabel="label" optionValue="value" size="small" styleClass="w-full" appendTo="body" panelStyleClass="dark:bg-slate-800 dark:border-gray-700"></p-select>
                    </div>

                    <div class="border-t border-gray-100 dark:border-gray-700 dark:border-slate-800 my-1"></div>

                    <!-- Advanced Features -->
                    <div class="flex justify-between items-center">
                        <span class="text-sm font-medium dark:text-gray-200 dark:border-slate-800">Comparar (Período Anterior)</span>
                        <p-toggleButton [(ngModel)]="widgetConfig.compareWithPrevious" (onChange)="updateChart()" onLabel="Sim" offLabel="Não" size="small" styleClass="w-16 text-xs"></p-toggleButton>
                    </div>
                    <div class="flex justify-between items-center" *ngIf="widgetConfig.type === 'line'">
                        <span class="text-sm font-medium dark:text-gray-200 dark:border-slate-800">Previsão (Tendência)</span>
                        <p-toggleButton [(ngModel)]="widgetConfig.showForecast" (onChange)="updateChart()" onLabel="Sim" offLabel="Não" size="small" styleClass="w-16 text-xs"></p-toggleButton>
                    </div>

                    <div class="border-t border-gray-100 dark:border-gray-700 my-1"></div>

                    <div class="flex justify-between items-center">
                         <span class="text-sm font-medium dark:text-gray-200">Resumo em Texto</span>
                         <p-toggleButton [(ngModel)]="widgetConfig.showSummary" onLabel="Sim" offLabel="Não" size="small" styleClass="w-16 text-xs"></p-toggleButton>
                    </div>

                    <p-button label="Exportar CSV" icon="pi pi-file-excel" size="small" severity="secondary" (onClick)="exportCSV()" styleClass="w-full"></p-button>
                </div>
            </p-popover>

            <!-- Delete Button -->
             <button pButton icon="pi pi-trash" class="p-button-text p-button-danger p-button-sm p-0 w-8 h-8" (click)="onRemoveWidget()"></button>
        </div>
      </div>

      <!-- Chart Area -->
      <div class="flex-grow relative min-h-[300px] overflow-hidden flex flex-col" [class.hidden]="widgetConfig.showSummary">
        <!-- Loading Skeleton -->
        <!-- Loading Skeleton -->
        <div *ngIf="isLoading()" class="absolute inset-0 bg-white dark:bg-slate-800 z-50 flex flex-col gap-4 p-4">
            <div class="flex justify-between items-end h-full gap-2">
                <p-skeleton height="40%" width="10%"></p-skeleton>
                <p-skeleton height="70%" width="10%"></p-skeleton>
                <p-skeleton height="50%" width="10%"></p-skeleton>
                <p-skeleton height="90%" width="10%"></p-skeleton>
                <p-skeleton height="60%" width="10%"></p-skeleton>
                <p-skeleton height="30%" width="10%"></p-skeleton>
                <p-skeleton height="80%" width="10%"></p-skeleton>
            </div>
        </div>

        <!-- Standard Charts -->
        <ng-container *ngIf="widgetConfig.type !== 'heatmap' && widgetConfig.type !== 'treemap' && widgetConfig.type !== 'boxplot' && widgetConfig.type !== 'sankey'">
            <p-chart *ngIf="hasStandardChartData()" [type]="widgetConfig.type" [data]="chartData" [options]="chartOptions" height="100%" width="100%"></p-chart>

            <div *ngIf="!hasStandardChartData()" class="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
                <i class="pi pi-chart-bar text-4xl mb-2 opacity-50"></i>
                <span class="text-sm">Não há dados para exibir.</span>
            </div>
        </ng-container>

        <!-- Heatmap (Disabled) -->
        <!-- <div *ngIf="widgetConfig.type === 'heatmap'">...</div> -->

        <!-- Treemap v1.0 -->
        <!-- Treemap v1.1 (Drill-down) -->
        <div *ngIf="widgetConfig.type === 'treemap'" class="relative w-full h-full bg-gray-50 dark:bg-slate-900 rounded overflow-hidden flex flex-col">
            <!-- Breadcrumbs -->
            <div class="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400" *ngIf="treemapPath.length > 0">
                <span class="cursor-pointer hover:text-blue-600 hover:underline" (click)="resetTreemapDrilldown()">Todas</span>
                <ng-container *ngFor="let item of treemapPath; let last = last">
                    <i class="pi pi-chevron-right text-[10px]"></i>
                    <span [class.font-bold]="last" [class.text-gray-900]="last" [class.dark:text-white]="last">{{ item }}</span>
                </ng-container>
            </div>

            <div class="relative flex-grow w-full overflow-hidden">
                <div *ngFor="let node of treemapData; trackBy: trackByLabel"
                     class="absolute border border-white dark:border-slate-800 flex flex-col items-center justify-center text-center p-1 transition-all duration-500 ease-in-out hover:brightness-110 cursor-pointer hover:z-10 hover:shadow-lg"
                     [style.left.%]="node.x"
                     [style.top.%]="node.y"
                     [style.width.%]="node.w"
                     [style.height.%]="node.h"
                     [style.backgroundColor]="node.color"
                     (click)="onTreemapNodeClick(node)"
                     [pTooltip]="node.label + ': ' + node.formattedValue + (treemapLevel === 'root' ? ' (Clique para detalhar)' : '')"
                     tooltipPosition="top">

                     <span class="text-white font-bold text-xs md:text-sm truncate w-full px-1 drop-shadow-md">{{ node.label }}</span>
                     <span *ngIf="node.h > 15" class="text-white text-[10px] opacity-90 drop-shadow-md">{{ node.formattedValue }}</span>
                </div>

                <div *ngIf="treemapData.length === 0" class="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="mb-2 opacity-50">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="3" y1="9" x2="21" y2="9"></line>
                        <line x1="9" y1="21" x2="9" y2="9"></line>
                    </svg>
                    <span class="text-sm">Sem dados para exibir.</span>
                </div>
            </div>
        </div>

        <!-- Box Plot v1.0 -->
        <div *ngIf="widgetConfig.type === 'boxplot'" class="w-full h-full flex flex-col overflow-y-auto pr-2">
            <div *ngFor="let item of boxPlotData" class="flex items-center mb-4 h-12 group">
                <!-- Label -->
                <div class="w-32 text-xs text-gray-600 dark:text-gray-400 font-medium truncate text-right pr-3" [title]="item.label">
                    {{ item.label }}
                </div>

                <!-- Plot Area -->
                <div class="flex-grow relative h-full bg-gray-50 dark:bg-slate-900 rounded border-l border-gray-200 dark:border-gray-700">
                    <!-- Whisker Line (Min to Max) -->
                    <div class="absolute top-1/2 h-[2px] bg-gray-300 dark:bg-gray-600 -translate-y-1/2 transition-all duration-500"
                         [style.left.%]="getBoxPlotPercent(item.min)"
                         [style.width.%]="getBoxPlotPercent(item.max - item.min)">
                    </div>

                    <!-- Whisker Caps -->
                    <div class="absolute top-1/2 h-3 w-[2px] bg-gray-400 dark:bg-gray-500 -translate-y-1/2 transition-all duration-500" [style.left.%]="getBoxPlotPercent(item.min)"></div>
                    <div class="absolute top-1/2 h-3 w-[2px] bg-gray-400 dark:bg-gray-500 -translate-y-1/2 transition-all duration-500" [style.left.%]="getBoxPlotPercent(item.max)"></div>

                    <!-- Box (Q1 to Q3) -->
                    <div class="absolute top-1/2 h-6 -translate-y-1/2 border border-gray-400 dark:border-gray-500 opacity-80 hover:opacity-100 transition-all duration-500"
                         [style.backgroundColor]="item.color"
                         [style.left.%]="getBoxPlotPercent(item.q1)"
                         [style.width.%]="getBoxPlotPercent(item.q3 - item.q1)"
                         [pTooltip]="'Min: ' + (item.min | currency) + '\nQ1: ' + (item.q1 | currency) + '\nMediana: ' + (item.median | currency) + '\nQ3: ' + (item.q3 | currency) + '\nMax: ' + (item.max | currency)"
                         tooltipPosition="top">
                    </div>

                    <!-- Median Line -->
                    <div class="absolute top-1/2 h-6 w-[3px] bg-white -translate-y-1/2 z-10 transition-all duration-500"
                         [style.left.%]="getBoxPlotPercent(item.median)">
                    </div>
                </div>
            </div>
             <div *ngIf="boxPlotData.length === 0" class="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
                 <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="mb-2 opacity-50">
                     <line x1="12" y1="20" x2="12" y2="10"></line>
                     <line x1="18" y1="20" x2="18" y2="4"></line>
                     <line x1="6" y1="20" x2="6" y2="16"></line>
                 </svg>
                 <span class="text-sm">Sem dados suficientes para distribuição.</span>
            </div>
        </div>

        <!-- Sankey Diagram v1.2 (Zoom/Pan) -->
        <div *ngIf="widgetConfig.type === 'sankey'" class="w-full h-full bg-white dark:bg-slate-800 rounded overflow-hidden relative flex items-center justify-center">
             <!-- Reset Zoom Button -->
             <button *ngIf="sankeyScale !== 1 || sankeyX !== 0 || sankeyY !== 0"
                     pButton
                     icon="pi pi-refresh"
                     class="p-button-rounded p-button-text p-button-sm absolute top-2 right-2 z-10 bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 shadow-sm"
                     (click)="resetZoom()"
                     pTooltip="Resetar Zoom">
             </button>

             <svg *ngIf="sankeyData.nodes.length > 0"
                  width="100%" height="100%"
                  viewBox="0 0 1000 600"
                  preserveAspectRatio="xMidYMid meet"
                  class="cursor-move"
                  (wheel)="onWheel($event)"
                  (mousedown)="onMouseDown($event)"
                  (mousemove)="onMouseMove($event)"
                  (mouseup)="onMouseUp()"
                  (mouseleave)="onMouseUp()">

                <g [attr.transform]="sankeyTransform">
                    <defs>
                        <linearGradient *ngFor="let link of sankeyData.links" [attr.id]="link.gradientId" gradientUnits="userSpaceOnUse">
                            <stop offset="0%" [attr.stop-color]="link.sourceColor" />
                            <stop offset="100%" [attr.stop-color]="link.targetColor" />
                        </linearGradient>
                    </defs>

                <!-- Links -->
                <path *ngFor="let link of sankeyData.links; trackBy: trackByLink"
                      [attr.d]="link.d"
                      [attr.stroke]="link.color"
                      [attr.stroke-width]="link.width"
                      fill="none"
                      stroke-opacity="0.4"
                      class="hover:stroke-opacity-70 transition-all duration-500 cursor-pointer ease-in-out"
                      [pTooltip]="link.source + ' -> ' + link.target + ': ' + (link.value | currency:'BRL')">
                </path>

                <!-- Nodes -->
                <g *ngFor="let node of sankeyData.nodes; trackBy: trackById">
                    <rect [attr.x]="node.x"
                          [attr.y]="node.y"
                          [attr.width]="node.w"
                          [attr.height]="node.h"
                          [attr.fill]="node.color"
                          rx="4" ry="4"
                          stroke="#fff" stroke-width="1"
                          class="transition-all duration-500 ease-in-out hover:brightness-110"
                          [pTooltip]="node.name + ': ' + (node.value | currency:'BRL')">
                    </rect>
                    <!-- Label -->
                    <text [attr.x]="node.column === 0 ? node.x - 8 : (node.column === 3 ? node.x + node.w + 8 : node.x + node.w / 2)"
                          [attr.y]="node.y + node.h / 2"
                          [attr.text-anchor]="node.column === 0 ? 'end' : (node.column === 3 ? 'start' : 'middle')"
                          [attr.transform]="(node.column === 1 || node.column === 2) ? 'rotate(-90, ' + (node.x + node.w/2) + ', ' + (node.y + node.h/2) + ')' : ''"
                          dominant-baseline="middle"
                          font-size="12"
                          font-weight="bold"
                          fill="#374151"
                          class="pointer-events-none select-none transition-all duration-500">
                        {{ node.name }}
                    </text>
                </g>
                </g>
             </svg>
             <div *ngIf="sankeyData.nodes.length === 0" class="flex flex-col items-center justify-center h-full text-gray-400">
                 <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="mb-2 opacity-50">
                     <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                 </svg>
                 <span class="text-sm">Sem dados de fluxo para exibir.</span>
            </div>
        </div>
      </div>

      <!-- Summary Area -->
      <div *ngIf="widgetConfig.showSummary" class="flex-grow flex flex-col gap-6 p-4 overflow-auto min-h-[300px] bg-white dark:bg-slate-800 rounded">
        <!-- Summary Cards -->
        <div class="flex flex-col gap-4 h-full">
            <!-- Main Stats Grid -->
            <div class="grid grid-cols-2 gap-3">
                <div class="p-3 bg-gray-50 dark:bg-slate-700 rounded-xl border border-gray-100 dark:border-gray-600 flex flex-col justify-center">
                    <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Transações</div>
                    <div class="text-lg font-bold text-gray-900 dark:text-white">{{summaryStats.totalTransactions}}</div>
                </div>

                <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 flex flex-col justify-center">
                    <div class="text-xs text-blue-600 dark:text-blue-400 mb-1">Saldo</div>
                    <div class="text-lg font-bold text-blue-700 dark:text-blue-300">{{summaryStats.net | currency:'BRL'}}</div>
                </div>

                <div class="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800 flex flex-col justify-center">
                    <div class="text-xs text-red-600 dark:text-red-400 mb-1">Despesas</div>
                    <div class="text-lg font-bold text-red-700 dark:text-red-300">{{summaryStats.totalExpense | currency:'BRL'}}</div>
                </div>

                <div class="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800 flex flex-col justify-center">
                    <div class="text-xs text-green-600 dark:text-green-400 mb-1">Receitas</div>
                    <div class="text-lg font-bold text-green-700 dark:text-green-300">{{summaryStats.totalIncome | currency:'BRL'}}</div>
                </div>
            </div>

            <div class="border-t border-gray-100 dark:border-gray-700"></div>

            <!-- Detailed Stats Grid -->
            <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div class="flex justify-between items-center">
                    <span class="text-gray-500 dark:text-gray-400">Maior Despesa</span>
                    <span class="font-medium text-gray-900 dark:text-gray-200">{{summaryStats.maxExpense | currency:'BRL'}}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-500 dark:text-gray-400">Média</span>
                    <span class="font-medium text-gray-900 dark:text-gray-200">{{summaryStats.avgTx | currency:'BRL'}}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-500 dark:text-gray-400">Início</span>
                    <span class="font-medium text-gray-900 dark:text-gray-200">{{summaryStats.firstDate | date:'dd/MM/yy'}}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-500 dark:text-gray-400">Fim</span>
                    <span class="font-medium text-gray-900 dark:text-gray-200">{{summaryStats.lastDate | date:'dd/MM/yy'}}</span>
                </div>
            </div>
        </div>
      </div>
  `
})
export class ChartWidgetComponent implements OnInit {
    private elementRef = inject(ElementRef);
    @Input() widgetConfig!: DashboardWidget;
    @Input() removeCallback!: (id: string) => void;
    @Output() toggleSize = new EventEmitter<string>();

    private transactionService = inject(TransactionService);
    private categoryService = inject(CategoryService);
    private colorService = inject(ColorService);

    isLoading = signal<boolean>(false);

    chartData: any;
    chartOptions: any;

    // Treemap Data
    treemapData: TreemapNode[] = [];
    treemapLevel: 'root' | 'category' = 'root';
    treemapPath: string[] = [];
    currentTreemapCategory: string | null = null;

    // Box Plot Data
    boxPlotData: BoxPlotItem[] = [];
    boxPlotGlobalMax = 0;

    // Sankey Data
    sankeyData: { nodes: SankeyNode[], links: SankeyLink[] } = { nodes: [], links: [] };

    // Sankey Zoom/Pan State
    sankeyScale = 1;
    sankeyX = 0;
    sankeyY = 0;
    isPanning = false;
    startX = 0;
    startY = 0;

    get sankeyTransform(): string {
        return `translate(${this.sankeyX}, ${this.sankeyY}) scale(${this.sankeyScale})`;
    }

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
        { label: 'Box Plot (Distribuição)', value: 'boxplot' },
        { label: 'Sankey (Fluxo)', value: 'sankey' }
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
    // private colorPalette = [ ... ]; // Removed in favor of ColorService

    private allTransactions: Transaction[] = [];
    private previousTransactions: Transaction[] = [];
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
        this.isLoading.set(true);

        const requests: any = {
            current: this.transactionService.getTransactions(undefined, undefined, undefined, start?.toISOString(), end?.toISOString())
        };

        if (this.widgetConfig.compareWithPrevious && start && end) {
            // Simple previous period calculation (same duration before start)
            const duration = end.getTime() - start.getTime();
            const prevStart = new Date(start.getTime() - duration);
            const prevEnd = new Date(end.getTime() - duration);
            requests.previous = this.transactionService.getTransactions(undefined, undefined, undefined, prevStart.toISOString(), prevEnd.toISOString());
        }

        forkJoin(requests).subscribe({
            next: (results: any) => {
                this.allTransactions = results.current;
                this.previousTransactions = results.previous || [];
                this.updateChartDataLocal();
                this.isLoading.set(false);
            },
            error: (err) => {
                console.error(err);
                this.isLoading.set(false);
            }
        });
    }

    onRemoveWidget() {
        if (this.removeCallback) {
            this.removeCallback(this.widgetConfig.id);
        }
    }

    onResizeWidget() {
        this.toggleSize.emit(this.widgetConfig.id);
        // Trigger chart resize/update after layout change
        setTimeout(() => {
            this.updateChart();
        }, 300); // Wait for transition
    }

    onDatePresetChange() {
        if (this.widgetConfig.datePreset !== 'custom') {
            this.widgetConfig.customDateRange = undefined;
            this.resetTreemapDrilldown(); // Reset drilldown on filter change
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

    exportChart() {
        const element = this.elementRef.nativeElement.querySelector('.relative'); // Target the chart container
        if (element) {
            html2canvas(element).then((canvas: HTMLCanvasElement) => {
                const link = document.createElement('a');
                link.download = `chart-${this.widgetConfig.title || 'export'}.png`;
                link.href = canvas.toDataURL();
                link.click();
            });
        }
    }

    exportCSV() {
        if (!this.allTransactions || this.allTransactions.length === 0) return;

        // Headers
        const headers = ['Data', 'Descrição', 'Categoria', 'Conta', 'Valor', 'Tipo', 'Pagamento'];
        const rows = this.allTransactions.map(t => [
            new Date(t.date).toLocaleDateString('pt-BR'),
            t.description,
            t.category?.name || 'N/A',
            t.account?.name || 'N/A',
            t.amount.toFixed(2).replace('.', ','),
            t.type === 'income' ? 'Receita' : 'Despesa',
            t.payment_method
        ]);

        let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // BOM for Excel
        csvContent += headers.join(";") + "\n";
        rows.forEach(row => {
            csvContent += row.join(";") + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `dados-${this.widgetConfig.title || 'export'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    getChartLabel(type: string): string {
        return this.chartTypes.find(t => t.value === type)?.label || type;
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
            // If we are in drill-down mode, filter transactions first
            let dataToProcess = filteredTransactions;
            if (this.treemapLevel === 'category' && this.currentTreemapCategory) {
                dataToProcess = filteredTransactions.filter(t =>
                    (t.category?.name === this.currentTreemapCategory) ||
                    (t.category?.parent_id && this.categoryMap.get(t.category.parent_id)?.name === this.currentTreemapCategory)
                );
            }
            this.generateTreemapData(dataToProcess);
        } else if (this.widgetConfig.type === 'boxplot') {
            this.generateBoxPlotData(filteredTransactions);
        } else if (this.widgetConfig.type === 'sankey') {
            this.generateSankeyData(filteredTransactions);
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

    // --- SANKEY LOGIC ---
    private generateSankeyData(transactions: Transaction[]) {
        const links: { source: string, target: string, value: number, type: string }[] = [];

        // Unique ID tracking to handle naming collisions between cols
        // We will suffix IDs with _colX to ensure uniqueness if names are same (e.g. "Other" in Income vs "Other" in Expense)
        const uniqueNodeIds = new Set<string>();

        const getNodeId = (name: string, col: number) => `${name}_${col}`; // Internal ID
        const getNodeName = (id: string) => id.substring(0, id.lastIndexOf('_')); // Display Name

        // Aggregation Maps
        const incomeToAccount: { [key: string]: number } = {};
        const accountToParent: { [key: string]: number } = {};
        const parentToSub: { [key: string]: number } = {};

        transactions.forEach(t => {
            const accountName = t.account?.name || 'Conta';
            const accountNodeId = getNodeId(accountName, 1);

            if (t.type === 'income') {
                // 1. Income Cat -> Account
                let catName = 'Outros';
                const catId = t.category_id || t.category?.id;
                if (catId && this.categoryMap.has(catId)) {
                    const cat = this.categoryMap.get(catId)!;
                    // Use parent name if available, or own name
                    if (cat.parent_id && this.categoryMap.has(cat.parent_id)) {
                        catName = this.categoryMap.get(cat.parent_id)!.name;
                    } else {
                        catName = cat.name;
                    }
                } else {
                    catName = t.category?.name || 'Sem Categoria';
                }

                const incomeNodeId = getNodeId(catName, 0);
                const linkKey = `${incomeNodeId}|${accountNodeId}`;

                if (!incomeToAccount[linkKey]) incomeToAccount[linkKey] = 0;
                incomeToAccount[linkKey] += t.amount;

            } else if (t.type === 'expense') {
                // 2. Account -> Expense Parent
                let parentName = 'Outros';
                let subName = 'Outros';
                const catId = t.category_id || t.category?.id;

                if (catId && this.categoryMap.has(catId)) {
                    const cat = this.categoryMap.get(catId)!;
                    if (cat.parent_id && this.categoryMap.has(cat.parent_id)) {
                        // It has a parent
                        parentName = this.categoryMap.get(cat.parent_id)!.name;
                        subName = cat.name;
                    } else {
                        // Is a root
                        parentName = cat.name;
                        subName = cat.name; // Self-link
                    }
                } else {
                    parentName = t.category?.name || 'Sem Categoria';
                    subName = parentName;
                }

                const parentNodeId = getNodeId(parentName, 2);
                const subNodeId = getNodeId(subName, 3);

                // Link Account -> Parent
                const accToParentKey = `${accountNodeId}|${parentNodeId}`;
                if (!accountToParent[accToParentKey]) accountToParent[accToParentKey] = 0;
                accountToParent[accToParentKey] += t.amount;

                // Link Parent -> Sub
                const parentToSubKey = `${parentNodeId}|${subNodeId}`;
                if (!parentToSub[parentToSubKey]) parentToSub[parentToSubKey] = 0;
                parentToSub[parentToSubKey] += t.amount;
            }
        });

        // Convert Maps to Links Array
        const processMap = (map: { [key: string]: number }) => {
            Object.entries(map).forEach(([key, val]) => {
                const [s, t] = key.split('|');
                links.push({ source: s, target: t, value: val, type: 'flow' });
                uniqueNodeIds.add(s);
                uniqueNodeIds.add(t);
            });
        };

        processMap(incomeToAccount);
        processMap(accountToParent);
        processMap(parentToSub);

        // 2. Nodes
        const nodes: SankeyNode[] = [];
        const nodeMap = new Map<string, SankeyNode>();

        // Define columns X positions
        const colX = [50, 300, 600, 900];
        const colColors = ['#22c55e', '#3b82f6', '#f97316', '#ef4444']; // Green, Blue, Orange, Red

        Array.from(uniqueNodeIds).forEach(id => {
            const col = parseInt(id.split('_').pop()!);
            // Calculate node value (Max of Input sum or Output sum)
            let flowIn = 0;
            let flowOut = 0;
            links.forEach(l => {
                if (l.target === id) flowIn += l.value;
                if (l.source === id) flowOut += l.value;
            });

            nodes.push({
                id: id,
                name: getNodeName(id),
                column: col,
                value: Math.max(flowIn, flowOut),
                x: colX[col],
                y: 0,
                w: 20,
                h: 0,
                color: this.colorService.getColor(col)
            });
        });

        nodes.forEach(n => nodeMap.set(n.id, n));

        // 3. Layout (Y positions)
        const colTotals = [0, 0, 0, 0];
        nodes.forEach(n => colTotals[n.column] += n.value);
        const maxTotal = Math.max(...colTotals);

        // Increase height to 600 for better spacing
        const SVG_HEIGHT = 600;
        const scaleY = maxTotal > 0 ? (SVG_HEIGHT - 100) / maxTotal : 0; // Leave 100px padding

        [0, 1, 2, 3].forEach(col => {
            let currentY = 50;
            const colNodes = nodes.filter(n => n.column === col).sort((a, b) => b.value - a.value);
            colNodes.forEach(n => {
                n.h = Math.max(n.value * scaleY, 10); // Min height 10
                n.y = currentY;
                currentY += n.h + 25; // Gap 25
            });
        });

        // 4. Generate Paths (Stroke based)
        const sourceOffsets: { [key: string]: number } = {};
        const targetOffsets: { [key: string]: number } = {};
        nodes.forEach(n => { sourceOffsets[n.id] = 0; targetOffsets[n.id] = 0; });

        const cleanLinks: SankeyLink[] = links.sort((a, b) => b.value - a.value).map(l => {
            const source = nodeMap.get(l.source)!;
            const target = nodeMap.get(l.target)!;

            const linkWidth = Math.max(l.value * scaleY, 2);

            const sy = source.y + sourceOffsets[source.id] + linkWidth / 2;
            const ty = target.y + targetOffsets[target.id] + linkWidth / 2;

            targetOffsets[target.id] += linkWidth;

            const sx = source.x + source.w;
            const tx = target.x;

            // Bezier Curve
            const dist = tx - sx;
            const cp1x = sx + dist * 0.4;
            const cp2x = tx - dist * 0.4;

            const gradientId = `grad_${source.id}_${target.id}`.replace(/[^a-zA-Z0-9-_]/g, '');

            return {
                source: source.name,
                target: target.name,
                value: l.value,
                width: linkWidth,
                d: `M ${sx} ${sy} C ${cp1x} ${sy}, ${cp2x} ${ty}, ${tx} ${ty}`,
                color: `url(#${gradientId})`, // Use Gradient
                gradientId: gradientId,
                sourceColor: source.color,
                targetColor: target.color
            };
        });

        this.sankeyData = { nodes, links: cleanLinks };
    }

    // --- SANKEY ZOOM/PAN HANDLERS ---
    onWheel(event: WheelEvent) {
        event.preventDefault();
        const zoomIntensity = 0.1;
        const direction = event.deltaY < 0 ? 1 : -1;
        const newScale = this.sankeyScale + (direction * zoomIntensity);

        // Limit zoom
        this.sankeyScale = Math.min(Math.max(0.5, newScale), 5);
    }

    onMouseDown(event: MouseEvent) {
        this.isPanning = true;
        this.startX = event.clientX - this.sankeyX;
        this.startY = event.clientY - this.sankeyY;
    }

    onMouseMove(event: MouseEvent) {
        if (!this.isPanning) return;
        event.preventDefault();
        this.sankeyX = event.clientX - this.startX;
        this.sankeyY = event.clientY - this.startY;
    }

    onMouseUp() {
        this.isPanning = false;
    }

    resetZoom() {
        this.sankeyScale = 1;
        this.sankeyX = 0;
        this.sankeyY = 0;
    }

    trackByLabel(index: number, item: any) {
        return item.label;
    }

    trackById(index: number, item: any) {
        return item.id;
    }

    trackByLink(index: number, item: any) {
        return item.source + item.target;
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
                color: this.colorService.getColorForLabel(key)
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


    private generateTreemapData(transactions: Transaction[]) {
        // Group by Category (Root) or Subcategory (Drill-down)
        const groups: { [key: string]: number } = {};

        transactions.forEach(t => {
            let key = 'Outros';

            if (this.treemapLevel === 'root') {
                // Group by Parent Category
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
            } else {
                // Group by Subcategory (Leaf)
                key = t.category?.name || 'Sem Categoria';
            }

            if (!groups[key]) groups[key] = 0;
            groups[key] += Math.abs(t.amount); // Use absolute value for size
        });

        // Convert to Nodes
        let nodes: TreemapNode[] = Object.entries(groups).map(([label, value], index) => ({
            label,
            value,
            formattedValue: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value),
            color: this.colorService.getColorForLabel(label), // Use consistent colors
            x: 0, y: 0, w: 0, h: 0
        }));

        // Sort by Value DESC
        nodes.sort((a, b) => b.value - a.value);

        // Squarified Layout Algorithm (Simplified)
        this.calculateTreemapLayout(nodes, 0, 0, 100, 100);

        this.treemapData = nodes;
    }

    onTreemapNodeClick(node: TreemapNode) {
        if (this.treemapLevel === 'root') {
            this.treemapLevel = 'category';
            this.currentTreemapCategory = node.label;
            this.treemapPath = [node.label];
            this.updateChartDataLocal(); // Re-generate with filter
        }
    }

    resetTreemapDrilldown() {
        this.treemapLevel = 'root';
        this.currentTreemapCategory = null;
        this.treemapPath = [];
        this.updateChartDataLocal();
    }

    private calculateTreemapLayout(nodes: TreemapNode[], x: number, y: number, w: number, h: number) {
        if (nodes.length === 0) return;

        // Base case
        if (nodes.length === 1) {
            nodes[0].x = x;
            nodes[0].y = y;
            nodes[0].w = w;
            nodes[0].h = h;
            return;
        }

        // Split logic (same as before but ensuring it matches signature)
        const total = nodes.reduce((sum, n) => sum + n.value, 0);
        let half = 0;
        let mid = 0;

        for (let i = 0; i < nodes.length; i++) {
            half += nodes[i].value;
            if (half >= total / 2) {
                mid = i + 1;
                break;
            }
        }

        if (mid >= nodes.length) mid = nodes.length - 1;
        if (mid === 0) mid = 1;

        const group1 = nodes.slice(0, mid);
        const group2 = nodes.slice(mid);

        const value1 = group1.reduce((sum, n) => sum + n.value, 0);
        const ratio = value1 / total;

        if (w > h) {
            // Split vertically
            const w1 = w * ratio;
            this.calculateTreemapLayout(group1, x, y, w1, h);
            this.calculateTreemapLayout(group2, x + w1, y, w - w1, h);
        } else {
            // Split horizontally
            const h1 = h * ratio;
            this.calculateTreemapLayout(group1, x, y, w, h1);
            this.calculateTreemapLayout(group2, x, y + h1, w, h - h1);
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
                startDate.setHours(0, 0, 0, 0);

                endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6); // End on Saturday
                endDate.setHours(23, 59, 59, 999);
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
        const backgroundColors = labels.map(label => this.colorService.getColorForLabel(label));

        const datasets: any[] = [
            {
                label: 'Atual',
                data: [...data], // Clone to avoid mutation issues
                backgroundColor: this.widgetConfig.type === 'line' ? '#3b82f6' : backgroundColors,
                borderColor: this.widgetConfig.type === 'line' ? '#3b82f6' : '#ffffff',
                fill: this.widgetConfig.type !== 'line',
                tension: 0.4
            }
        ];

        // Comparison Logic
        if (this.widgetConfig.compareWithPrevious && this.previousTransactions.length > 0) {
            const prevGrouped = this.groupData(this.previousTransactions);
            // Align previous data with current labels
            const prevData = labels.map(label => prevGrouped[label] || 0);

            datasets.push({
                label: 'Anterior',
                data: prevData,
                backgroundColor: this.widgetConfig.type === 'line' ? '#9ca3af' : '#e5e7eb',
                borderColor: '#9ca3af',
                borderDash: [5, 5],
                fill: false,
                tension: 0.4
            });
        }

        // Forecast Logic (Simple Linear Regression)
        if (this.widgetConfig.showForecast && this.widgetConfig.type === 'line' && this.widgetConfig.groupBy === 'date') {
            const n = data.length;
            if (n > 1) {
                const { slope, intercept } = this.calculateLinearRegression(data);

                // Generate trend line for existing points
                const trendData = data.map((_, i) => slope * i + intercept);

                // Add 1 future point
                const nextVal = slope * n + intercept;
                trendData.push(nextVal);
                labels.push('Previsão');

                // Pad original datasets
                datasets.forEach(ds => ds.data.push(null));

                datasets.push({
                    label: 'Tendência',
                    data: trendData,
                    borderColor: '#f59e0b',
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0
                });
            }
        }

        return {
            labels: labels,
            datasets: datasets
        };
    }

    private calculateLinearRegression(data: number[]) {
        const n = data.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        for (let i = 0; i < n; i++) {
            sumX += i;
            sumY += data[i];
            sumXY += i * data[i];
            sumXX += i * i;
        }

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        return { slope, intercept };
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

    hasStandardChartData(): boolean {
        if (!this.chartData || !this.chartData.datasets || !this.chartData.datasets.length) return false;

        // Return true if any dataset has at least one data point
        return this.chartData.datasets.some((ds: any) => ds.data && ds.data.length > 0);
    }
}

// Helper function for lerp (linear interpolation), usually available in d3-interpolate but implemented simply here
function d3_interpolateNumber(a: number, b: number) {
    return function (t: number) {
        return a * (1 - t) + b * t;
    };
}
