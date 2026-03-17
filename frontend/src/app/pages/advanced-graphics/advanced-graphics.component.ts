import {
  Component,
  signal,
  ElementRef,
  ViewChild,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { ToolbarModule } from 'primeng/toolbar';
import { ChartWidgetComponent } from '../../components/chart-widget/chart-widget.component';
import {
  DashboardWidget,
  DateRangePreset,
  WidgetType,
} from '../../models/dashboard-widget.model';
import { SubscriptionService } from '../../services/subscription.service';
import { TooltipModule } from 'primeng/tooltip';
import html2canvas from 'html2canvas';
import { TransactionService } from '../../services/transaction.service';

@Component({
  selector: 'app-advanced-graphics',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    ChartWidgetComponent,
    FormsModule,
    SelectModule,
    ToolbarModule,
    TooltipModule,
  ],
  template: `
    <div class="p-4 md:p-10 min-h-screen bg-surface-ground/20" #dashboardGrid>
      <!-- Standard Header Section -->
      <div class="page-header mb-12">
        <div class="page-title-group">
          <h1
            class="page-title text-4xl font-black tracking-tight mb-2 text-emphasis"
          >
            Gráficos Avançados
          </h1>
          <p class="page-description text-lg text-secondary/80">
            Visualize seus dados financeiros com gráficos interativos e
            detalhados de alta performance.
          </p>
        </div>
        <div class="page-actions w-full md:w-auto">
          <p-button
            (onClick)="addChart()"
            styleClass="bg-primary hover:bg-primary-600 text-white border-none shadow-2xl shadow-primary transition-all duration-500 transform hover:-translate-y-1 active:scale-95 rounded-2xl px-8 py-4 font-black"
          >
            <ng-template pTemplate="content">
              <i class="pi pi-plus-circle mr-3 text-xl"></i>
              <span class="">Novo Gráfico</span>
            </ng-template>
          </p-button>
        </div>
      </div>

      <!-- Glassmorphic Global Toolbar -->
      <div
        class="backdrop-blur-2xl bg-surface-card/60 border border-white/20 dark:border-white/5 rounded-[2.5rem] p-8 shadow-2xl shadow-surface-900/5 mb-12 relative overflow-hidden group"
      >
        <!-- Background Glow Decoration -->
        <div
          class="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 blur-[100px] rounded-full group-hover:bg-primary/20 transition-all duration-1000"
        ></div>

        <div
          class="flex flex-col xl:flex-row xl:items-center justify-between gap-8 relative z-10"
        >
          <!-- Left Side: Controls -->
          <div
            class="flex flex-col lg:flex-row gap-8 lg:items-center w-full xl:w-auto"
          >
            <div class="flex items-center gap-4 shrink-0">
              <div
                class="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner"
              >
                <i class="pi pi-sliders-h text-xl"></i>
              </div>
              <div class="flex flex-col">
                <span
                  class="font-black text-emphasis tracking-tighter uppercase text-xs"
                  >Filtros Globais</span
                >
                <span
                  class="text-[10px] text-secondary font-medium tracking-wide"
                  >Sincronizar todos os widgets</span
                >
              </div>
            </div>

            <div class="flex flex-wrap gap-6 w-full xl:w-auto">
              <!-- Período -->
              <div
                class="flex flex-col gap-2 min-w-[160px] flex-1 sm:flex-none"
              >
                <label
                  class="text-[10px] font-black text-secondary uppercase tracking-[0.1em] ml-1 opacity-70"
                  >Período</label
                >
                <p-select
                  [options]="datePresets"
                  [(ngModel)]="globalDatePreset"
                  optionLabel="label"
                  optionValue="value"
                  styleClass="w-full !bg-surface-ground/50 !border-surface-border !rounded-2xl transition-all hover:!border-primary/50 hover:!shadow-lg hover:!shadow-primary/5"
                  appendTo="body"
                  panelStyleClass="premium-dropdown-panel"
                >
                </p-select>
              </div>

              <!-- Tipo de Gráfico -->
              <div
                class="flex flex-col gap-2 min-w-[160px] flex-1 sm:flex-none"
              >
                <label
                  class="text-[10px] font-black text-secondary uppercase tracking-[0.1em] ml-1 opacity-70"
                  >Estilo</label
                >
                <p-select
                  [options]="chartTypes"
                  [(ngModel)]="globalType"
                  optionLabel="label"
                  optionValue="value"
                  styleClass="w-full !bg-surface-ground/50 !border-surface-border !rounded-2xl transition-all hover:!border-primary/50 hover:!shadow-lg hover:!shadow-primary/5"
                  appendTo="body"
                  panelStyleClass="premium-dropdown-panel"
                >
                  <ng-template pTemplate="item" let-item>
                    <div
                      class="flex items-center justify-between w-full gap-3 py-1"
                    >
                      <span class="text-sm font-semibold">{{
                        item.label
                      }}</span>
                      <span
                        *ngIf="
                          item.pro &&
                          !subscriptionService.canAccess('monthly_report')
                        "
                        class="text-[9px] uppercase font-black text-white bg-gradient-to-br from-amber-400 to-orange-600 px-2.5 py-1 rounded-lg shadow-sm"
                        >Pro</span
                      >
                    </div>
                  </ng-template>
                </p-select>
              </div>

              <!-- Filtro de Valores -->
              <div
                class="flex flex-col gap-2 min-w-[160px] flex-1 sm:flex-none"
              >
                <label
                  class="text-[10px] font-black text-secondary uppercase tracking-[0.1em] ml-1 opacity-70"
                  >Fluxo</label
                >
                <p-select
                  [options]="valueFilterOptions"
                  [(ngModel)]="globalValueFilter"
                  optionLabel="label"
                  optionValue="value"
                  styleClass="w-full !bg-surface-ground/50 !border-surface-border !rounded-2xl transition-all hover:!border-primary/50 hover:!shadow-lg hover:!shadow-primary/5"
                  appendTo="body"
                  panelStyleClass="premium-dropdown-panel"
                >
                </p-select>
              </div>

              <!-- Agrupamento -->
              <div
                class="flex flex-col gap-2 min-w-[160px] flex-1 sm:flex-none"
              >
                <label
                  class="text-[10px] font-black text-secondary uppercase tracking-[0.1em] ml-1 opacity-70"
                  >Dimensão</label
                >
                <p-select
                  [options]="groupingOptions"
                  [(ngModel)]="globalGroupBy"
                  optionLabel="label"
                  optionValue="value"
                  styleClass="w-full !bg-surface-ground/50 !border-surface-border !rounded-2xl transition-all hover:!border-primary/50 hover:!shadow-lg hover:!shadow-primary/5"
                  appendTo="body"
                  panelStyleClass="premium-dropdown-panel"
                >
                </p-select>
              </div>
            </div>

            <p-button
              label="Sincronizar"
              icon="pi pi-sync"
              (onClick)="applyGlobalFilters()"
              styleClass="w-full lg:w-auto px-8 py-3.5 bg-surface-900 dark:bg-surface-50 text-white dark:text-surface-900 rounded-2xl font-black text-sm transition-all hover:shadow-2xl hover:shadow-surface-900/20 hover:-translate-y-1 active:translate-y-0"
            >
            </p-button>
          </div>

          <!-- Right Side: Export & Pro -->
          <div
            class="flex flex-row items-center gap-4 w-full xl:w-auto xl:border-l xl:border-surface-border xl:pl-8"
          >
            <p-button
              icon="pi pi-download"
              pTooltip="Exportar Dados (CSV)"
              tooltipPosition="top"
              (onClick)="exportAllCSV()"
              [disabled]="!subscriptionService.canAccess('monthly_report')"
              styleClass="flex-1 xl:flex-none w-14 h-14 rounded-2xl bg-surface-ground border border-surface-border hover:bg-surface-hover text-emphasis transition-all duration-300"
            >
            </p-button>

            <p-button
              *ngIf="!subscriptionService.canAccess('monthly_report')"
              label="Upgrade para PRO"
              icon="pi pi-sparkles"
              (onClick)="navigateToPricing()"
              styleClass="flex-1 xl:flex-none px-8 py-4 bg-gradient-to-br from-amber-400 via-orange-500 to-red-600 text-white border-none rounded-2xl font-black shadow-xl shadow-orange-500/30 transition-all hover:shadow-2xl hover:shadow-orange-500/40 hover:-translate-y-1 active:translate-y-0 text-sm tracking-tight"
            >
            </p-button>
          </div>
        </div>
      </div>

      <!-- Main Content Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-10">
        @for (widget of widgets(); track widget.id; let i = $index) {
          <div
            class="group/widget transition-all duration-700"
            [ngClass]="{
              'md:col-span-1': !widget.colSpan || widget.colSpan === 1,
              'md:col-span-2': widget.colSpan === 2,
              'opacity-30 scale-[0.98] blur-sm': draggedIndex === i,
            }"
            [draggable]="draggedIndex === i || hoveredIndex === i"
            (dragstart)="onDragStart(i)"
            (dragover)="onDragOver($event, i)"
            (drop)="onDrop(i)"
            (dragend)="onDragEnd()"
          >
            <div class="h-[550px] relative">
              <!-- Animated Drag Handle -->
              <div
                class="absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-2 bg-surface-900 dark:bg-surface-50 rounded-2xl shadow-2xl cursor-grab active:cursor-grabbing z-50 opacity-0 group-hover/widget:opacity-100 -translate-y-4 group-hover/widget:translate-y-0 transition-all duration-500 flex items-center gap-3"
                title="Arraste para organizar"
                (mouseenter)="hoveredIndex = i"
                (mouseleave)="hoveredIndex = null"
              >
                <i class="pi pi-arrows-alt text-xs text-primary"></i>
                <span
                  class="text-[10px] font-black uppercase tracking-[0.2em] text-surface-400"
                  >Mover</span
                >
              </div>

              <div
                class="h-full rounded-[3rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-surface-border bg-white dark:bg-surface-card transition-all duration-500 group-hover/widget:shadow-[0_40px_80px_rgba(0,0,0,0.12)] group-hover/widget:-translate-y-2"
              >
                <app-chart-widget
                  [widgetConfig]="widget"
                  [removeCallback]="removeWidget.bind(this)"
                  (toggleSize)="toggleSize($event)"
                >
                </app-chart-widget>
              </div>
            </div>
          </div>
        }
      </div>

      <!-- Empty State -->
      @if (widgets().length === 0) {
        <div
          class="flex flex-col items-center justify-center p-24 bg-surface-card/40 backdrop-blur-md rounded-[4rem] border-4 border-dashed border-surface-border animate-in fade-in zoom-in duration-1000"
        >
          <div class="relative mb-10">
            <div
              class="absolute inset-0 bg-primary blur-[80px] opacity-20 rounded-full animate-pulse"
            ></div>
            <div
              class="relative w-28 h-28 bg-surface-ground rounded-[2.5rem] flex items-center justify-center text-primary shadow-2xl"
            >
              <i class="pi pi-chart-line text-5xl"></i>
            </div>
          </div>
          <h2 class="text-4xl font-black text-emphasis mb-4 tracking-tighter">
            Sua jornada analítica começa aqui
          </h2>
          <p
            class="text-secondary text-lg mb-12 max-w-md text-center leading-relaxed"
          >
            Não há dados sendo exibidos agora. Adicione seu primeiro gráfico
            para transformar números em decisões inteligentes.
          </p>
          <p-button
            label="Criar meu primeiro gráfico"
            icon="pi pi-plus-circle"
            (onClick)="addChart()"
            styleClass="bg-primary hover:bg-primary-600 text-white border-none rounded-2xl px-12 py-5 font-black text-lg shadow-2xl shadow-primary/40 transition-all duration-500 hover:-translate-y-2 active:translate-y-0"
          ></p-button>
        </div>
      }
    </div>
  `,
})
export class AdvancedGraphicsComponent {
  @ViewChild('dashboardGrid') dashboardGrid!: ElementRef;
  subscriptionService = inject(SubscriptionService);
  transactionService = inject(TransactionService);
  router = inject(Router);

  navigateToPricing() {
    this.router.navigate(['/pricing']);
  }

  widgets = signal<DashboardWidget[]>([
    {
      id: '1',
      type: 'bar',
      datePreset: 'last-month',
      groupBy: 'date',
      valueFilter: 'expense',
      showSummary: false,
      colSpan: 1,
    },
    {
      id: '2',
      type: 'doughnut',
      datePreset: 'this-year',
      groupBy: 'category',
      valueFilter: 'both',
      showSummary: false,
      colSpan: 1,
    },
  ]);

  globalDatePreset: string = 'none';
  globalType: string = 'none';
  globalGroupBy: string = 'none';
  globalValueFilter: string = 'none';

  // Drag & Drop State
  draggedIndex: number | null = null;
  hoveredIndex: number | null = null;

  datePresets = [
    { label: 'Sem Alteração', value: 'none' },
    { label: 'Esse Mês', value: 'this-month' },
    { label: 'Mês Passado', value: 'last-month' },
    { label: 'Esse Ano', value: 'this-year' },
    { label: 'Essa Semana', value: 'this-week' },
  ];

  chartTypes: { label: string; value: string; pro?: boolean }[] = [
    { label: 'Sem Alteração', value: 'none' },
    { label: 'Pizza', value: 'pie' },
    { label: 'Rosca', value: 'doughnut' },
    { label: 'Barras', value: 'bar' },
    { label: 'Linha', value: 'line' },
    { label: 'Treemap', value: 'treemap', pro: true },
    { label: 'Box Plot', value: 'boxplot', pro: true },
    { label: 'Sankey', value: 'sankey', pro: true },
  ];

  groupingOptions = [
    { label: 'Sem Alteração', value: 'none' },
    { label: 'Categoria', value: 'category' },
    { label: 'Subcategoria', value: 'subcategory' },
    { label: 'Forma de Pagamento', value: 'payment-method' },
    { label: 'Data', value: 'date' },
  ];

  valueFilterOptions = [
    { label: 'Sem Alteração', value: 'none' },
    { label: 'Ambos', value: 'both' },
    { label: 'Receitas', value: 'income' },
    { label: 'Despesas', value: 'expense' },
  ];

  applyGlobalFilters() {
    this.widgets.update((widgets) =>
      widgets.map((w) => {
        let newW = { ...w };
        if (this.globalDatePreset !== 'none') {
          newW.datePreset = this.globalDatePreset as DateRangePreset;
        }
        if (this.globalType !== 'none') {
          const isProType = this.chartTypes.find(
            (t) => t.value === this.globalType,
          )?.pro;
          if (
            isProType &&
            !this.subscriptionService.canAccess('monthly_report')
          ) {
            // Cannot apply pro type
          } else {
            newW.type = this.globalType as WidgetType;
          }
        }
        if (this.globalGroupBy !== 'none') {
          newW.groupBy = this.globalGroupBy as any;
        }
        if (this.globalValueFilter !== 'none') {
          newW.valueFilter = this.globalValueFilter as any;
        }
        return newW;
      }),
    );
  }

  addChart() {
    const newWidget: DashboardWidget = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'bar', // Default
      datePreset: 'this-month',
      groupBy: 'category',
      valueFilter: 'both',
      showSummary: false,
      colSpan: 1,
    };

    this.widgets.update((widgets) => [...widgets, newWidget]);
  }

  removeWidget(id: string) {
    this.widgets.update((widgets) => widgets.filter((w) => w.id !== id));
  }

  toggleSize(id: string) {
    this.widgets.update((widgets) =>
      widgets.map((w) => {
        if (w.id === id) {
          return { ...w, colSpan: w.colSpan === 2 ? 1 : 2 };
        }
        return w;
      }),
    );
  }

  // --- Drag & Drop Logic ---
  onDragStart(index: number) {
    this.draggedIndex = index;
  }

  onDragOver(event: DragEvent, index: number) {
    event.preventDefault(); // Allow drop
    // Optional: Add visual cue for drop target
  }

  onDrop(dropIndex: number) {
    if (this.draggedIndex === null || this.draggedIndex === dropIndex) return;

    this.widgets.update((widgets) => {
      const newWidgets = [...widgets];
      const [draggedItem] = newWidgets.splice(this.draggedIndex!, 1);
      newWidgets.splice(dropIndex, 0, draggedItem);
      return newWidgets;
    });

    this.draggedIndex = null;
  }

  onDragEnd() {
    this.draggedIndex = null;
  }

  // --- Export Logic ---
  exportAllCSV() {
    if (!this.subscriptionService.canAccess('monthly_report')) return;

    // Let's use the most common date range from widgets, or globalDatePreset
    let preset =
      this.globalDatePreset !== 'none' ? this.globalDatePreset : 'this-year';
    const now = new Date();
    let start: Date | undefined;
    let end: Date | undefined = now;

    if (preset === 'this-month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (preset === 'last-month') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (preset === 'this-year') {
      start = new Date(now.getFullYear(), 0, 1);
    } else if (preset === 'this-week') {
      const dayOfWeek = now.getDay();
      start = new Date(now);
      start.setDate(now.getDate() - dayOfWeek);
      start.setHours(0, 0, 0, 0);
    } else {
      // ALL TIME
      start = undefined;
      end = undefined;
    }

    this.transactionService
      .getTransactions(
        undefined,
        undefined,
        undefined,
        start?.toISOString(),
        end?.toISOString(),
      )
      .subscribe((txs) => {
        const headers = [
          'Data',
          'Descrição',
          'Categoria',
          'Conta',
          'Valor',
          'Tipo',
          'Pagamento',
        ];
        const rows = txs.map((t) => [
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

        const blob = new Blob([csvContent], {
          type: 'text/csv;charset=utf-8;',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute(
          'download',
          `todas-transacoes-${new Date().toISOString().slice(0, 10)}.csv`,
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      });
  }
}
