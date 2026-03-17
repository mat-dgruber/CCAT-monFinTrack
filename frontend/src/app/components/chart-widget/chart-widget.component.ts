import {
  Component,
  Input,
  OnInit,
  OnChanges,
  SimpleChanges,
  Signal,
  computed,
  effect,
  signal,
  inject,
  ViewChild,
  ElementRef,
  Output,
  EventEmitter,
} from '@angular/core';
import { forkJoin } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartModule } from 'primeng/chart';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { ButtonModule } from 'primeng/button';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import { PopoverModule } from 'primeng/popover';
import { SkeletonModule } from 'primeng/skeleton';
import {
  DashboardWidget,
  DateRangePreset,
  GroupingOption,
  ValueFilter,
  WidgetType,
} from '../../models/dashboard-widget.model';
import { Transaction } from '../../models/transaction.model';
import { Category } from '../../models/category.model';
import { TransactionService } from '../../services/transaction.service';
import { CategoryService } from '../../services/category.service';
import { ColorService } from '../../services/color.service';
import { SubscriptionService } from '../../services/subscription.service';
import html2canvas from 'html2canvas';
import { PageHelpComponent } from '../page-help/page-help';

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
    ToggleSwitchModule,
    TooltipModule,
    PopoverModule,
    SkeletonModule,
    PageHelpComponent,
  ],
  styles: [
    `
      ::ng-deep {
        .modern-popover {
          border-radius: 2rem !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          background: rgba(var(--surface-card-rgb), 0.95) !important;
          backdrop-filter: blur(20px) !important;
          box-shadow: 0 40px 100px rgba(0, 0, 0, 0.2) !important;
        }

        .p-popover-content {
          padding: 0 !important;
        }

        .p-select {
          border-radius: 1rem !important;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(var(--primary-rgb), 0.2);
          border-radius: 10px;
        }
      }
    `,
  ],
  template: `
    <div
      class="bg-surface-card rounded-[3rem] p-8 flex flex-col h-full relative transition-all duration-500 overflow-hidden"
    >
      <!-- Toolbar -->
      <div
        class="flex flex-wrap gap-4 mb-6 items-center justify-between border-b border-surface-border/50 pb-6"
      >
        <div class="flex items-center gap-4">
          <!-- Title or Type Icon -->
          <div
            class="w-12 h-12 rounded-2xl bg-surface-ground flex items-center justify-center text-primary shadow-inner"
          >
            <i
              class="pi text-xl"
              [ngClass]="{
                'pi-chart-pie':
                  widgetConfig.type === 'pie' ||
                  widgetConfig.type === 'doughnut',
                'pi-chart-bar': widgetConfig.type === 'bar',
                'pi-chart-line': widgetConfig.type === 'line',
                'pi-th-large': widgetConfig.type === 'treemap',
                'pi-box': widgetConfig.type === 'boxplot',
                'pi-share-alt': widgetConfig.type === 'sankey',
              }"
            ></i>
          </div>
          <div class="flex flex-col">
            <span
              *ngIf="widgetConfig.title"
              class="text-lg font-black text-emphasis tracking-tight"
              >{{ widgetConfig.title }}</span
            >
            <span
              *ngIf="!widgetConfig.title"
              class="text-lg font-black text-emphasis tracking-tight capitalize"
              >{{ getChartLabel(widgetConfig.type) }}</span
            >
            <span
              class="text-[10px] text-secondary font-bold uppercase tracking-widest opacity-60"
            >
              {{ getGroupingLabel(widgetConfig.groupBy) || 'Análise' }} •
              {{ getDatePresetLabel(widgetConfig.datePreset) || 'Período' }}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <!-- Resize Button -->
          <button
            pButton
            [icon]="
              widgetConfig.colSpan === 2
                ? 'pi pi-window-minimize'
                : 'pi pi-window-maximize'
            "
            class="w-10 h-10 rounded-xl bg-surface-ground border-none text-secondary hover:text-primary hover:bg-primary/10 transition-all duration-300"
            (click)="onResizeWidget()"
            [pTooltip]="widgetConfig.colSpan === 2 ? 'Recolher' : 'Expandir'"
          ></button>

          <!-- Settings Button -->
          <button
            pButton
            icon="pi pi-cog"
            class="w-10 h-10 rounded-xl bg-surface-ground border-none text-secondary hover:text-primary hover:bg-primary/10 transition-all duration-300"
            (click)="op.toggle($event)"
            pTooltip="Ajustes"
          ></button>

          <p-popover #op styleClass="modern-popover">
            <div class="flex flex-col gap-5 w-80 p-4">
              <div
                class="flex items-center gap-3 border-b border-surface-border pb-3"
              >
                <i class="pi pi-cog text-primary"></i>
                <span class="font-black text-emphasis tracking-tight"
                  >Configurações</span
                >
              </div>

              <!-- Settings Content -->
              <div class="flex flex-col gap-4">
                <div class="flex flex-col gap-2">
                  <label
                    class="text-[10px] font-black text-secondary uppercase tracking-widest opacity-70"
                    >Tipo de Visualização</label
                  >
                  <p-select
                    [options]="chartTypes()"
                    [(ngModel)]="widgetConfig.type"
                    (onChange)="updateChart()"
                    optionLabel="label"
                    optionValue="value"
                    styleClass="w-full !rounded-xl !bg-surface-ground"
                    appendTo="body"
                  >
                    <ng-template pTemplate="item" let-item>
                      <div
                        class="flex items-center justify-between w-full gap-3"
                      >
                        <span class="text-sm font-semibold">{{
                          item.label
                        }}</span>
                        <span
                          *ngIf="
                            item.pro &&
                            !subscriptionService.canAccess('monthly_report')
                          "
                          class="text-[8px] uppercase font-black text-white bg-gradient-to-r from-amber-400 to-orange-600 px-2 py-0.5 rounded-md"
                          >Pro</span
                        >
                      </div>
                    </ng-template>
                  </p-select>
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <div class="flex flex-col gap-2">
                    <label
                      class="text-[10px] font-black text-secondary uppercase tracking-widest opacity-70"
                      >Período</label
                    >
                    <p-select
                      [options]="datePresets"
                      [(ngModel)]="widgetConfig.datePreset"
                      (onChange)="onDatePresetChange()"
                      optionLabel="label"
                      optionValue="value"
                      styleClass="w-full !rounded-xl !bg-surface-ground"
                      appendTo="body"
                    ></p-select>
                  </div>
                  <div class="flex flex-col gap-2">
                    <label
                      class="text-[10px] font-black text-secondary uppercase tracking-widest opacity-70"
                      >Filtro</label
                    >
                    <p-select
                      [options]="valueFilterOptions"
                      [(ngModel)]="widgetConfig.valueFilter"
                      (onChange)="updateChart()"
                      optionLabel="label"
                      optionValue="value"
                      styleClass="w-full !rounded-xl !bg-surface-ground"
                      appendTo="body"
                    ></p-select>
                  </div>
                </div>

                <div
                  class="flex flex-col gap-2"
                  *ngIf="
                    widgetConfig.type !== 'heatmap' &&
                    widgetConfig.type !== 'treemap' &&
                    widgetConfig.type !== 'sankey'
                  "
                >
                  <label
                    class="text-[10px] font-black text-secondary uppercase tracking-widest opacity-70"
                    >Agrupar Por</label
                  >
                  <p-select
                    [options]="groupingOptions"
                    [(ngModel)]="widgetConfig.groupBy"
                    (onChange)="updateChart()"
                    optionLabel="label"
                    optionValue="value"
                    styleClass="w-full !rounded-xl !bg-surface-ground"
                    appendTo="body"
                  ></p-select>
                </div>

                <div class="flex flex-col gap-3 pt-2">
                  <div
                    class="flex justify-between items-center p-3 bg-surface-ground rounded-xl"
                  >
                    <span class="text-xs font-bold text-emphasis"
                      >Comparar Anterior</span
                    >
                    <p-toggleswitch
                      [(ngModel)]="widgetConfig.compareWithPrevious"
                      (ngModelChange)="updateChart()"
                    ></p-toggleswitch>
                  </div>
                  <div
                    class="flex justify-between items-center p-3 bg-surface-ground rounded-xl"
                  >
                    <span class="text-xs font-bold text-emphasis"
                      >Modo Resumo</span
                    >
                    <p-toggleswitch
                      [(ngModel)]="widgetConfig.showSummary"
                    ></p-toggleswitch>
                  </div>
                </div>

                <p-button
                  label="Exportar CSV"
                  icon="pi pi-file-excel"
                  (onClick)="exportCSV()"
                  [disabled]="!subscriptionService.canAccess('monthly_report')"
                  styleClass="w-full mt-2 rounded-xl bg-surface-900 text-white border-none font-bold py-3"
                >
                </p-button>
              </div>
            </div>
          </p-popover>

          <!-- Delete Button -->
          <button
            pButton
            icon="pi pi-trash"
            class="w-10 h-10 rounded-xl bg-surface-ground border-none text-red-400 hover:text-red-500 hover:bg-red-500/10 transition-all duration-300"
            (click)="onRemoveWidget()"
          ></button>
          <app-page-help document="chart-widget.md"></app-page-help>
        </div>
      </div>

      <!-- Chart Area -->
      <div
        class="flex-grow relative min-h-[350px] overflow-hidden flex flex-col"
        [class.hidden]="widgetConfig.showSummary"
      >
        <!-- Loading Skeleton -->
        <div
          *ngIf="isLoading()"
          class="absolute inset-0 bg-surface-card z-50 flex items-center justify-center"
        >
          <div class="flex items-end gap-3 w-full h-48 px-8">
            <p-skeleton
              height="40%"
              width="12%"
              styleClass="rounded-t-xl"
            ></p-skeleton>
            <p-skeleton
              height="70%"
              width="12%"
              styleClass="rounded-t-xl"
            ></p-skeleton>
            <p-skeleton
              height="50%"
              width="12%"
              styleClass="rounded-t-xl"
            ></p-skeleton>
            <p-skeleton
              height="90%"
              width="12%"
              styleClass="rounded-t-xl"
            ></p-skeleton>
            <p-skeleton
              height="60%"
              width="12%"
              styleClass="rounded-t-xl"
            ></p-skeleton>
            <p-skeleton
              height="30%"
              width="12%"
              styleClass="rounded-t-xl"
            ></p-skeleton>
            <p-skeleton
              height="80%"
              width="12%"
              styleClass="rounded-t-xl"
            ></p-skeleton>
          </div>
        </div>

        <!-- Standard Charts -->
        <ng-container
          *ngIf="
            widgetConfig.type !== 'heatmap' &&
            widgetConfig.type !== 'treemap' &&
            widgetConfig.type !== 'boxplot' &&
            widgetConfig.type !== 'sankey'
          "
        >
          <div class="h-full w-full animate-in fade-in duration-700">
            <p-chart
              *ngIf="hasStandardChartData()"
              [type]="widgetConfig.type"
              [data]="chartData"
              [options]="chartOptions"
              height="100%"
              width="100%"
            ></p-chart>

            <div
              *ngIf="!hasStandardChartData()"
              class="flex flex-col items-center justify-center h-full text-secondary/40"
            >
              <i class="pi pi-chart-bar text-6xl mb-4 opacity-20"></i>
              <span class="text-sm font-bold tracking-tight"
                >Sem dados suficientes</span
              >
            </div>
          </div>
        </ng-container>

        <!-- Treemap, Boxplot, Sankey... (Keep existing but wrapped in transition) -->
        <div
          *ngIf="widgetConfig.type === 'treemap'"
          class="animate-in fade-in duration-700 h-full"
        >
          <!-- Treemap content (keep as is but ensure good styling) -->
          <div
            class="relative w-full h-full bg-surface-ground/30 rounded-3xl overflow-hidden flex flex-col border border-surface-border/50"
          >
            <!-- Breadcrumbs -->
            <div
              class="flex items-center gap-2 p-3 bg-surface-card border-b border-surface-border text-[10px] font-black uppercase tracking-widest text-secondary"
              *ngIf="treemapPath.length > 0"
            >
              <span
                class="cursor-pointer hover:text-primary transition-colors"
                (click)="resetTreemapDrilldown()"
                >Geral</span
              >
              <ng-container *ngFor="let item of treemapPath; let last = last">
                <i class="pi pi-chevron-right text-[8px]"></i>
                <span [class.text-primary]="last">{{ item }}</span>
              </ng-container>
            </div>

            <div class="relative flex-grow w-full overflow-hidden">
              <div
                *ngFor="let node of treemapData; trackBy: trackByLabel"
                class="absolute border-[0.5px] border-white/20 flex flex-col items-center justify-center text-center p-2 transition-all duration-700 ease-in-out hover:brightness-110 cursor-pointer hover:z-10 hover:shadow-2xl hover:scale-[1.02]"
                [style.left.%]="node.x"
                [style.top.%]="node.y"
                [style.width.%]="node.w"
                [style.height.%]="node.h"
                [style.backgroundColor]="node.color"
                (click)="onTreemapNodeClick(node)"
                [pTooltip]="node.label + ': ' + node.formattedValue"
              >
                <span
                  class="text-white font-black text-xs md:text-sm truncate w-full px-2 drop-shadow-lg"
                  >{{ node.label }}</span
                >
                <span
                  *ngIf="node.h > 15"
                  class="text-white text-[10px] font-bold opacity-80 drop-shadow-md"
                  >{{ node.formattedValue }}</span
                >
              </div>
            </div>
          </div>
        </div>

        <!-- BoxPlot & Sankey (Keep logic, refresh UI) -->
        <div
          *ngIf="widgetConfig.type === 'boxplot'"
          class="animate-in fade-in duration-700 h-full overflow-y-auto pr-2 custom-scrollbar"
        >
          <div
            *ngFor="let item of boxPlotData"
            class="flex items-center mb-6 h-14 group/box"
          >
            <div
              class="w-32 text-[10px] font-black text-secondary uppercase tracking-widest truncate text-right pr-4 opacity-70"
            >
              {{ item.label }}
            </div>
            <div
              class="flex-grow relative h-full bg-surface-ground/50 rounded-2xl border border-surface-border/30 overflow-hidden"
            >
              <div
                class="absolute top-1/2 h-[2px] bg-primary/20 -translate-y-1/2 transition-all duration-700"
                [style.left.%]="getBoxPlotPercent(item.min)"
                [style.width.%]="getBoxPlotPercent(item.max - item.min)"
              ></div>
              <div
                class="absolute top-1/2 h-4 w-[2px] bg-primary/40 -translate-y-1/2"
                [style.left.%]="getBoxPlotPercent(item.min)"
              ></div>
              <div
                class="absolute top-1/2 h-4 w-[2px] bg-primary/40 -translate-y-1/2"
                [style.left.%]="getBoxPlotPercent(item.max)"
              ></div>
              <div
                class="absolute top-1/2 h-8 -translate-y-1/2 rounded-lg border border-white/20 shadow-xl transition-all duration-700 hover:scale-y-110"
                [style.backgroundColor]="item.color"
                [style.left.%]="getBoxPlotPercent(item.q1)"
                [style.width.%]="getBoxPlotPercent(item.q3 - item.q1)"
                [pTooltip]="
                  'Min: ' +
                  (item.min | currency) +
                  ' | Mediana: ' +
                  (item.median | currency) +
                  ' | Max: ' +
                  (item.max | currency)
                "
              ></div>
              <div
                class="absolute top-1/2 h-8 w-[3px] bg-white/80 rounded-full -translate-y-1/2 z-10"
                [style.left.%]="getBoxPlotPercent(item.median)"
              ></div>
            </div>
          </div>
        </div>

        <div
          *ngIf="widgetConfig.type === 'sankey'"
          class="animate-in fade-in duration-700 h-full relative group/sankey"
        >
          <!-- Sankey SVG (Logic preserved, UI refined) -->
          <div
            class="w-full h-full bg-surface-ground/30 rounded-[2rem] overflow-hidden relative border border-surface-border/50"
          >
            <!-- Reset Zoom -->
            <button
              *ngIf="sankeyScale !== 1"
              (click)="resetZoom()"
              class="absolute top-4 right-4 z-20 w-10 h-10 rounded-xl bg-white/80 dark:bg-surface-card/80 backdrop-blur-md shadow-lg flex items-center justify-center text-primary hover:scale-110 transition-transform"
            >
              <i class="pi pi-refresh"></i>
            </button>
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 1000 600"
              preserveAspectRatio="xMidYMid meet"
              class="cursor-grab active:cursor-grabbing"
              (wheel)="onWheel($event)"
              (mousedown)="onMouseDown($event)"
              (mousemove)="onMouseMove($event)"
              (mouseup)="onMouseUp()"
              (mouseleave)="onMouseUp()"
            >
              <g [attr.transform]="sankeyTransform">
                <defs>
                  <linearGradient
                    *ngFor="let link of sankeyData.links"
                    [attr.id]="link.gradientId"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" [attr.stop-color]="link.sourceColor" />
                    <stop offset="100%" [attr.stop-color]="link.targetColor" />
                  </linearGradient>
                </defs>
                <path
                  *ngFor="let link of sankeyData.links; trackBy: trackByLink"
                  [attr.d]="link.d"
                  [attr.stroke]="link.color"
                  [attr.stroke-width]="link.width"
                  fill="none"
                  stroke-opacity="0.2"
                  class="hover:stroke-opacity-60 transition-all duration-500 cursor-pointer"
                ></path>
                <g *ngFor="let node of sankeyData.nodes; trackBy: trackById">
                  <rect
                    [attr.x]="node.x"
                    [attr.y]="node.y"
                    [attr.width]="node.w"
                    [attr.height]="node.h"
                    [attr.fill]="node.color"
                    rx="8"
                    ry="8"
                    class="hover:brightness-110 transition-all"
                  ></rect>
                  <text
                    [attr.x]="
                      node.column === 0
                        ? node.x - 12
                        : node.column === 3
                          ? node.x + node.w + 12
                          : node.x + node.w / 2
                    "
                    [attr.y]="node.y + node.h / 2"
                    [attr.text-anchor]="
                      node.column === 0
                        ? 'end'
                        : node.column === 3
                          ? 'start'
                          : 'middle'
                    "
                    dominant-baseline="middle"
                    font-size="14"
                    font-weight="900"
                    class="fill-emphasis pointer-events-none select-none"
                  >
                    {{ node.name }}
                  </text>
                </g>
              </g>
            </svg>
          </div>
        </div>
      </div>

      <!-- Summary Area -->
      <div
        *ngIf="widgetConfig.showSummary"
        class="flex-grow flex flex-col gap-8 p-6 overflow-auto animate-in slide-in-from-bottom-4 duration-700"
      >
        <div class="grid grid-cols-2 gap-6">
          <div
            class="p-6 bg-surface-ground rounded-[2rem] border border-surface-border/50 transition-transform hover:scale-[1.02]"
          >
            <div
              class="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-2 opacity-60"
            >
              Transações
            </div>
            <div class="text-3xl font-black text-emphasis tracking-tighter">
              {{ summaryStats.totalTransactions }}
            </div>
          </div>
          <div
            class="p-6 bg-blue-500/10 rounded-[2rem] border border-blue-500/20 transition-transform hover:scale-[1.02]"
          >
            <div
              class="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-2 opacity-80"
            >
              Saldo Líquido
            </div>
            <div
              class="text-3xl font-black text-blue-600 dark:text-blue-400 tracking-tighter"
            >
              {{ summaryStats.net | currency: 'BRL' }}
            </div>
          </div>
          <div
            class="p-6 bg-red-500/10 rounded-[2rem] border border-red-500/20 transition-transform hover:scale-[1.02]"
          >
            <div
              class="text-[10px] font-black text-red-500 uppercase tracking-[0.2em] mb-2 opacity-80"
            >
              Total Saídas
            </div>
            <div
              class="text-3xl font-black text-red-600 dark:text-red-400 tracking-tighter"
            >
              {{ summaryStats.totalExpense | currency: 'BRL' }}
            </div>
          </div>
          <div
            class="p-6 bg-green-500/10 rounded-[2rem] border border-green-500/20 transition-transform hover:scale-[1.02]"
          >
            <div
              class="text-[10px] font-black text-green-500 uppercase tracking-[0.2em] mb-2 opacity-80"
            >
              Total Entradas
            </div>
            <div
              class="text-3xl font-black text-green-600 dark:text-green-400 tracking-tighter"
            >
              {{ summaryStats.totalIncome | currency: 'BRL' }}
            </div>
          </div>
        </div>

        <div
          class="flex flex-col gap-4 bg-surface-ground/30 p-8 rounded-[2.5rem] border border-surface-border/30"
        >
          <div class="flex justify-between items-center">
            <span class="text-sm font-bold text-secondary"
              >Média por Operação</span
            >
            <span class="text-lg font-black text-emphasis">{{
              summaryStats.avgTx | currency: 'BRL'
            }}</span>
          </div>
          <div class="h-px bg-surface-border/50"></div>
          <div class="flex justify-between items-center">
            <span class="text-sm font-bold text-secondary">Maior Despesa</span>
            <span class="text-lg font-black text-red-500">{{
              summaryStats.maxExpense | currency: 'BRL'
            }}</span>
          </div>
          <div class="h-px bg-surface-border/50"></div>
          <div class="flex justify-between items-center">
            <span class="text-sm font-bold text-secondary"
              >Intervalo de Dados</span
            >
            <span class="text-sm font-black text-emphasis"
              >{{ summaryStats.firstDate | date: 'dd/MM/yyyy' }} -
              {{ summaryStats.lastDate | date: 'dd/MM/yyyy' }}</span
            >
          </div>
        </div>
      </div>
    </div>
  `,
})
export class ChartWidgetComponent implements OnInit, OnChanges {
  private elementRef = inject(ElementRef);
  @Input() widgetConfig!: DashboardWidget;
  @Input() removeCallback!: (id: string) => void;
  @Output() toggleSize = new EventEmitter<string>();

  private transactionService = inject(TransactionService);
  private categoryService = inject(CategoryService);
  private colorService = inject(ColorService);
  public subscriptionService = inject(SubscriptionService);

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
  sankeyData: { nodes: SankeyNode[]; links: SankeyLink[] } = {
    nodes: [],
    links: [],
  };

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
    lastDate: null,
  };

  // Computed chart types with Pro check
  chartTypes = computed(() => {
    const canAccessPro = this.subscriptionService.canAccess('monthly_report');
    return [
      { label: 'Pizza', value: 'pie' },
      { label: 'Rosca', value: 'doughnut' },
      { label: 'Barras', value: 'bar' },
      { label: 'Linha', value: 'line' },
      {
        label: 'Treemap (Categorias)',
        value: 'treemap',
        pro: true,
        disabled: !canAccessPro,
      },
      {
        label: 'Box Plot (Distribuição)',
        value: 'boxplot',
        pro: true,
        disabled: !canAccessPro,
      },
      {
        label: 'Sankey (Fluxo)',
        value: 'sankey',
        pro: true,
        disabled: !canAccessPro,
      },
    ];
  });

  datePresets = [
    { label: 'Esse Mês', value: 'this-month' },
    { label: 'Mês Passado', value: 'last-month' },
    { label: 'Esse Ano', value: 'this-year' },
    { label: 'Essa Semana', value: 'this-week' },
    { label: 'Customizado', value: 'custom' },
  ];

  groupingOptions = [
    { label: 'Categoria', value: 'category' },
    { label: 'Subcategoria', value: 'subcategory' },
    { label: 'Forma de Pagamento', value: 'payment-method' },
    { label: 'Data', value: 'date' },
  ];

  valueFilterOptions = [
    { label: 'Ambos', value: 'both' },
    { label: 'Receitas', value: 'income' },
    { label: 'Despesas', value: 'expense' },
  ];

  // Palette for deterministic colors
  // private colorPalette = [ ... ]; // Removed in favor of ColorService

  private allTransactions: Transaction[] = [];
  private previousTransactions: Transaction[] = [];
  private categoryMap = new Map<string, Category>();

  ngOnInit() {
    // Load categories for hierarchy resolution
    this.categoryService.getCategories().subscribe((cats) => {
      this.buildCategoryMap(cats);
      this.fetchData();
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['widgetConfig'] && !changes['widgetConfig'].firstChange) {
      const current = changes['widgetConfig'].currentValue;
      const previous = changes['widgetConfig'].previousValue;

      // If date preset changed, refetch data
      if (
        current.datePreset !== previous.datePreset ||
        current.customDateRange !== previous.customDateRange ||
        current.compareWithPrevious !== previous.compareWithPrevious
      ) {
        this.fetchData();
      } else {
        // Otherwise just update chart with existing data (e.g. type change, group by, etc)
        this.updateChartDataLocal();
      }
    }
  }

  trackByDate(index: number, cell: any): string {
    return cell.date;
  }

  buildCategoryMap(categories: Category[]) {
    categories.forEach((cat) => {
      if (cat.id) this.categoryMap.set(cat.id, cat);
      if (cat.subcategories) {
        cat.subcategories.forEach((sub) => {
          if (sub.id)
            this.categoryMap.set(sub.id, { ...sub, parent_id: cat.id }); // Flatten for lookup, ensuring parent link
        });
      }
    });
  }

  fetchData() {
    const { start, end } = this.calculateDateRange();
    this.isLoading.set(true);

    const requests: any = {
      current: this.transactionService.getTransactions(
        undefined,
        undefined,
        undefined,
        start?.toISOString(),
        end?.toISOString(),
      ),
    };

    if (this.widgetConfig.compareWithPrevious && start && end) {
      // Simple previous period calculation (same duration before start)
      const duration = end.getTime() - start.getTime();
      const prevStart = new Date(start.getTime() - duration);
      const prevEnd = new Date(end.getTime() - duration);
      requests.previous = this.transactionService.getTransactions(
        undefined,
        undefined,
        undefined,
        prevStart.toISOString(),
        prevEnd.toISOString(),
      );
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
      },
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

  exportCSV() {
    if (!this.subscriptionService.canAccess('monthly_report')) return;
    if (!this.allTransactions || this.allTransactions.length === 0) return;

    // Headers
    const headers = [
      'Data',
      'Descrição',
      'Categoria',
      'Conta',
      'Valor',
      'Tipo',
      'Pagamento',
    ];
    const rows = this.allTransactions.map((t) => [
      new Date(t.date).toLocaleDateString('pt-BR'),
      t.description,
      t.category?.name || 'N/A',
      t.account?.name || 'N/A',
      t.amount.toFixed(2).replace('.', ','),
      t.type === 'income' ? 'Receita' : 'Despesa',
      t.payment_method,
    ]);

    let csvContent = '\uFEFF' + headers.join(';') + '\n';
    rows.forEach((row) => {
      csvContent += row.join(';') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `dados-${this.widgetConfig.title || 'export'}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  getChartLabel(type: string): string {
    return this.chartTypes().find((t) => t.value === type)?.label || type;
  }

  getGroupingLabel(value: string): string {
    return this.groupingOptions.find((o) => o.value === value)?.label || value;
  }

  getDatePresetLabel(value: string): string {
    return this.datePresets.find((p) => p.value === value)?.label || value;
  }

  private updateChartDataLocal() {
    // Filter based on ValueFilter
    const filteredTransactions = this.allTransactions.filter((t) => {
      // Exclude 'transfer' type (like Fatura Cartão) from charts to avoid duplication/noise
      if (t.type === 'transfer') return false;

      if (this.widgetConfig.valueFilter === 'income' && t.type !== 'income')
        return false;
      if (this.widgetConfig.valueFilter === 'expense' && t.type !== 'expense')
        return false;
      return true;
    });

    // Calculate Stats
    this.calculateStats(filteredTransactions);

    if (this.widgetConfig.type === 'treemap') {
      // If we are in drill-down mode, filter transactions first
      let dataToProcess = filteredTransactions;
      if (this.treemapLevel === 'category' && this.currentTreemapCategory) {
        dataToProcess = filteredTransactions.filter(
          (t) =>
            t.category?.name === this.currentTreemapCategory ||
            (t.category?.parent_id &&
              this.categoryMap.get(t.category.parent_id)?.name ===
                this.currentTreemapCategory),
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
    const links: {
      source: string;
      target: string;
      value: number;
      type: string;
    }[] = [];

    // Unique ID tracking to handle naming collisions between cols
    // We will suffix IDs with _colX to ensure uniqueness if names are same (e.g. "Other" in Income vs "Other" in Expense)
    const uniqueNodeIds = new Set<string>();

    const getNodeId = (name: string, col: number) => `${name}_${col}`; // Internal ID
    const getNodeName = (id: string) => id.substring(0, id.lastIndexOf('_')); // Display Name

    // Aggregation Maps
    const incomeToAccount: { [key: string]: number } = {};
    const accountToParent: { [key: string]: number } = {};
    const parentToSub: { [key: string]: number } = {};

    transactions.forEach((t) => {
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
        if (!accountToParent[accToParentKey])
          accountToParent[accToParentKey] = 0;
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

    Array.from(uniqueNodeIds).forEach((id) => {
      const col = parseInt(id.split('_').pop()!);
      // Calculate node value (Max of Input sum or Output sum)
      let flowIn = 0;
      let flowOut = 0;
      links.forEach((l) => {
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
        color: this.colorService.getColor(col),
      });
    });

    nodes.forEach((n) => nodeMap.set(n.id, n));

    // 3. Layout (Y positions)
    const colTotals = [0, 0, 0, 0];
    nodes.forEach((n) => (colTotals[n.column] += n.value));
    const maxTotal = Math.max(...colTotals);

    // Increase height to 600 for better spacing
    const SVG_HEIGHT = 600;
    const scaleY = maxTotal > 0 ? (SVG_HEIGHT - 100) / maxTotal : 0; // Leave 100px padding

    [0, 1, 2, 3].forEach((col) => {
      let currentY = 50;
      const colNodes = nodes
        .filter((n) => n.column === col)
        .sort((a, b) => b.value - a.value);
      colNodes.forEach((n) => {
        n.h = Math.max(n.value * scaleY, 10); // Min height 10
        n.y = currentY;
        currentY += n.h + 25; // Gap 25
      });
    });

    // 4. Generate Paths (Stroke based)
    const sourceOffsets: { [key: string]: number } = {};
    const targetOffsets: { [key: string]: number } = {};
    nodes.forEach((n) => {
      sourceOffsets[n.id] = 0;
      targetOffsets[n.id] = 0;
    });

    const cleanLinks: SankeyLink[] = links
      .sort((a, b) => b.value - a.value)
      .map((l) => {
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

        const gradientId = `grad_${source.id}_${target.id}`.replace(
          /[^a-zA-Z0-9-_]/g,
          '',
        );

        return {
          source: source.name,
          target: target.name,
          value: l.value,
          width: linkWidth,
          d: `M ${sx} ${sy} C ${cp1x} ${sy}, ${cp2x} ${ty}, ${tx} ${ty}`,
          color: `url(#${gradientId})`, // Use Gradient
          gradientId: gradientId,
          sourceColor: source.color,
          targetColor: target.color,
        };
      });

    this.sankeyData = { nodes, links: cleanLinks };
  }

  // --- SANKEY ZOOM/PAN HANDLERS ---
  onWheel(event: WheelEvent) {
    event.preventDefault();
    const zoomIntensity = 0.1;
    const direction = event.deltaY < 0 ? 1 : -1;
    const newScale = this.sankeyScale + direction * zoomIntensity;

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
      credit_card: 'Cartão de Crédito',
      debit_card: 'Débito',
      pix: 'Pix',
      cash: 'Dinheiro',
      bank_transfer: 'Transferência',
      other: 'Outros',
    };

    transactions.forEach((t) => {
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
    this.boxPlotData = Object.keys(groups)
      .map((key) => {
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
          color: this.colorService.getColorForLabel(key),
        };
      })
      .sort((a, b) => b.median - a.median); // Sort by median descending
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

    transactions.forEach((t) => {
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
    let nodes: TreemapNode[] = Object.entries(groups).map(
      ([label, value], index) => ({
        label,
        value,
        formattedValue: new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(value),
        color: this.colorService.getColorForLabel(label), // Use consistent colors
        x: 0,
        y: 0,
        w: 0,
        h: 0,
      }),
    );

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

  private calculateTreemapLayout(
    nodes: TreemapNode[],
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
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

  private calculateDateRange(): { start?: Date; end?: Date } {
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
        if (
          this.widgetConfig.customDateRange &&
          this.widgetConfig.customDateRange[0]
        ) {
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
      credit_card: 'Cartão de Crédito',
      debit_card: 'Débito',
      pix: 'Pix',
      cash: 'Dinheiro',
      bank_transfer: 'Transferência',
      other: 'Outros',
    };

    transactions.forEach((t) => {
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
    const avg =
      list.length > 0 ? (totalIncome + totalExpense) / list.length : 0;

    this.summaryStats = {
      totalTransactions,
      totalIncome,
      totalExpense,
      net,
      maxTx,
      maxExpense,
      avgTx: avg,
      firstDate: list.length > 0 ? minDate : null,
      lastDate: list.length > 0 ? maxDate : null,
    };
  }

  private generateChartData(grouped: { [key: string]: number }) {
    const labels = Object.keys(grouped);
    const data = Object.values(grouped);

    // Deterministic Colors
    const backgroundColors = labels.map((label) =>
      this.colorService.getColorForLabel(label),
    );

    const datasets: any[] = [
      {
        label: 'Atual',
        data: [...data], // Clone to avoid mutation issues
        backgroundColor:
          this.widgetConfig.type === 'line' ? '#3b82f6' : backgroundColors,
        borderColor: this.widgetConfig.type === 'line' ? '#3b82f6' : '#ffffff',
        fill: this.widgetConfig.type !== 'line',
        tension: 0.4,
      },
    ];

    // Comparison Logic
    if (
      this.widgetConfig.compareWithPrevious &&
      this.previousTransactions.length > 0
    ) {
      const prevGrouped = this.groupData(this.previousTransactions);
      // Align previous data with current labels
      const prevData = labels.map((label) => prevGrouped[label] || 0);

      datasets.push({
        label: 'Anterior',
        data: prevData,
        backgroundColor:
          this.widgetConfig.type === 'line' ? '#9ca3af' : '#e5e7eb',
        borderColor: '#9ca3af',
        borderDash: [5, 5],
        fill: false,
        tension: 0.4,
      });
    }

    // Forecast Logic (Simple Linear Regression)
    if (
      this.widgetConfig.showForecast &&
      this.widgetConfig.type === 'line' &&
      this.widgetConfig.groupBy === 'date'
    ) {
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
        datasets.forEach((ds) => ds.data.push(null));

        datasets.push({
          label: 'Tendência',
          data: trendData,
          borderColor: '#f59e0b',
          borderDash: [5, 5],
          fill: false,
          pointRadius: 0,
        });
      }
    }

    return {
      labels: labels,
      datasets: datasets,
    };
  }

  private calculateLinearRegression(data: number[]) {
    const n = data.length;
    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumXX = 0;
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
          display: this.widgetConfig.type !== 'bar',
        },
      },
      maintainAspectRatio: false,
      scales:
        this.widgetConfig.type === 'bar' || this.widgetConfig.type === 'line'
          ? {
              y: {
                beginAtZero: true,
              },
            }
          : undefined,
    };
  }

  hasStandardChartData(): boolean {
    if (
      !this.chartData ||
      !this.chartData.datasets ||
      !this.chartData.datasets.length
    )
      return false;

    // Return true if any dataset has at least one data point
    return this.chartData.datasets.some(
      (ds: any) => ds.data && ds.data.length > 0,
    );
  }
}

// Helper function for lerp (linear interpolation), usually available in d3-interpolate but implemented simply here
function d3_interpolateNumber(a: number, b: number) {
  return function (t: number) {
    return a * (1 - t) + b * t;
  };
}
