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
    <div class="p-4 md:p-8 min-h-screen bg-surface-ground/20" #dashboardGrid>
      <!-- Standard Header Section -->
      <div class="page-header mb-8">
        <div class="page-title-group">
          <h1 class="page-title">Gráficos Avançados</h1>
          <p class="page-description">
            Visualize seus dados financeiros com gráficos interativos e
            detalhados.
          </p>
        </div>
        <div class="page-actions w-full md:w-auto">
          <p-button
            (onClick)="addChart()"
            styleClass="bg-primary hover:bg-primary-dark text-white border-none shadow-lg shadow-primary/20 transition-all duration-300 transform hover:scale-105 active:scale-95 rounded-xl px-6 py-3"
          >
            <ng-template pTemplate="content">
              <i class="pi pi-plus mr-2 font-bold"></i>
              <span class="font-bold tracking-wide">Adicionar Gráfico</span>
            </ng-template>
          </p-button>
        </div>
      </div>

      <!-- Glassmorphic Global Toolbar -->
      <div
        class="mb-8 relative overflow-hidden rounded-3xl border border-white/20 dark:border-surface-border/50 bg-white/60 dark:bg-surface-card/60 backdrop-blur-xl shadow-xl shadow-surface-900/5 p-1"
      >
        <div
          class="p-5 md:p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-6"
        >
          <!-- Left Side: Controls -->
          <div
            class="flex flex-col lg:flex-row gap-6 lg:items-center w-full xl:w-auto"
          >
            <div class="flex items-center gap-2 shrink-0">
              <div
                class="w-8 h-8 rounded-lg bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-surface-600"
              >
                <i class="pi pi-filter"></i>
              </div>
              <span
                class="font-bold text-surface-900 tracking-tight uppercase text-xs"
                >Filtros Globais</span
              >
            </div>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 w-full xl:w-auto">
              <!-- Período -->
              <div class="flex flex-col gap-1.5 min-w-[140px]">
                <label
                  class="text-[10px] font-bold text-surface-500 uppercase tracking-wider ml-1"
                  >Período</label
                >
                <p-select
                  [options]="datePresets"
                  [(ngModel)]="globalDatePreset"
                  optionLabel="label"
                  optionValue="value"
                  size="small"
                  styleClass="w-full !bg-surface-50/50 dark:!bg-surface-900/30 !border-surface-200 dark:!border-surface-700 !rounded-xl transition-all hover:!border-primary/50 overflow-hidden"
                  appendTo="body"
                  panelStyleClass="premium-dropdown-panel"
                >
                </p-select>
              </div>

              <!-- Tipo de Gráfico -->
              <div class="flex flex-col gap-1.5 min-w-[140px]">
                <label
                  class="text-[10px] font-bold text-surface-500 uppercase tracking-wider ml-1"
                  >Gráfico</label
                >
                <p-select
                  [options]="chartTypes"
                  [(ngModel)]="globalType"
                  optionLabel="label"
                  optionValue="value"
                  size="small"
                  styleClass="w-full !bg-surface-50/50 dark:!bg-surface-900/30 !border-surface-200 dark:!border-surface-700 !rounded-xl transition-all hover:!border-primary/50 overflow-hidden"
                  appendTo="body"
                  panelStyleClass="premium-dropdown-panel"
                >
                  <ng-template pTemplate="item" let-item>
                    <div class="flex items-center justify-between w-full gap-2">
                      <span class="text-sm font-medium">{{ item.label }}</span>
                      <span
                        *ngIf="
                          item.pro &&
                          !subscriptionService.canAccess('monthly_report')
                        "
                        class="text-[9px] uppercase font-black text-white bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-0.5 rounded-full shadow-sm"
                        >Pro</span
                      >
                    </div>
                  </ng-template>
                </p-select>
              </div>

              <!-- Filtro de Valores -->
              <div class="flex flex-col gap-1.5 min-w-[140px]">
                <label
                  class="text-[10px] font-bold text-surface-500 uppercase tracking-wider ml-1"
                  >Valores</label
                >
                <p-select
                  [options]="valueFilterOptions"
                  [(ngModel)]="globalValueFilter"
                  optionLabel="label"
                  optionValue="value"
                  size="small"
                  styleClass="w-full !bg-surface-50/50 dark:!bg-surface-900/30 !border-surface-200 dark:!border-surface-700 !rounded-xl transition-all hover:!border-primary/50 overflow-hidden"
                  appendTo="body"
                  panelStyleClass="premium-dropdown-panel"
                >
                </p-select>
              </div>

              <!-- Agrupamento -->
              <div class="flex flex-col gap-1.5 min-w-[140px]">
                <label
                  class="text-[10px] font-bold text-surface-500 uppercase tracking-wider ml-1"
                  >Agrupamento</label
                >
                <p-select
                  [options]="groupingOptions"
                  [(ngModel)]="globalGroupBy"
                  optionLabel="label"
                  optionValue="value"
                  size="small"
                  styleClass="w-full !bg-surface-50/50 dark:!bg-surface-900/30 !border-surface-200 dark:!border-surface-700 !rounded-xl transition-all hover:!border-primary/50 overflow-hidden"
                  appendTo="body"
                  panelStyleClass="premium-dropdown-panel"
                >
                </p-select>
              </div>
            </div>

            <p-button
              label="Atualizar Dashboard"
              icon="pi pi-sync"
              size="small"
              (onClick)="applyGlobalFilters()"
              styleClass="w-full lg:w-auto px-6 py-2.5 bg-surface-900 dark:bg-surface-50 text-white dark:text-surface-900 rounded-xl font-bold text-sm transition-all hover:shadow-lg hover:-translate-y-0.5"
            >
            </p-button>
          </div>

          <!-- Right Side: Export & Pro -->
          <div
            class="flex flex-row items-center gap-3 w-full xl:w-auto xl:border-l xl:border-surface-200 xl:dark:border-surface-700 xl:pl-6"
          >
            <p-button
              label="Exportar"
              icon="pi pi-download"
              size="small"
              severity="secondary"
              (onClick)="exportAllCSV()"
              [disabled]="!subscriptionService.canAccess('monthly_report')"
              [pTooltip]="
                !subscriptionService.canAccess('monthly_report')
                  ? 'Exclusivo para membros PRO'
                  : ''
              "
              styleClass="flex-1 xl:flex-none px-5 py-2.5 rounded-xl font-bold border-surface-200 transition-all hover:bg-surface-100"
            >
            </p-button>

            <p-button
              *ngIf="!subscriptionService.canAccess('monthly_report')"
              label="Desbloquear PRO"
              icon="pi pi-sparkles"
              size="small"
              (onClick)="navigateToPricing()"
              styleClass="flex-1 xl:flex-none px-5 py-2.5 bg-gradient-to-br from-amber-400 to-orange-500 text-white border-none rounded-xl font-bold shadow-md shadow-orange-500/20 transition-all hover:shadow-lg hover:-translate-y-0.5"
            >
            </p-button>
          </div>
        </div>
      </div>

      <!-- Main Content Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
        @for (widget of widgets(); track widget.id; let i = $index) {
          <div
            class="group/widget transition-all duration-500"
            [ngClass]="{
              'md:col-span-1': !widget.colSpan || widget.colSpan === 1,
              'md:col-span-2': widget.colSpan === 2,
              'opacity-40 scale-95': draggedIndex === i,
            }"
            [draggable]="draggedIndex === i || hoveredIndex === i"
            (dragstart)="onDragStart(i)"
            (dragover)="onDragOver($event, i)"
            (drop)="onDrop(i)"
            (dragend)="onDragEnd()"
          >
            <div class="h-[520px] relative">
              <!-- Animated Drag Handle -->
              <div
                class="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-surface-900 dark:bg-surface-50 rounded-full shadow-lg cursor-grab active:cursor-grabbing z-50 opacity-0 group-hover/widget:opacity-100 -translate-y-2 group-hover/widget:translate-y-0 transition-all duration-300 flex items-center gap-2"
                title="Arraste para organizar"
                (mouseenter)="hoveredIndex = i"
                (mouseleave)="hoveredIndex = null"
              >
                <i class="pi pi-grip-vertical text-[10px] text-surface-400"></i>
                <span
                  class="text-[9px] font-black uppercase tracking-widest text-surface-400"
                  >Organizar</span
                >
              </div>

              <div
                class="h-full rounded-[2rem] overflow-hidden shadow-2xl shadow-surface-900/10 border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-card transition-transform duration-300 group-hover/widget:-translate-y-1"
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
          class="flex flex-col items-center justify-center p-20 bg-white/40 dark:bg-surface-card/40 backdrop-blur-md rounded-[3rem] border-2 border-dashed border-surface-300 dark:border-surface-700 animate-in fade-in zoom-in duration-500"
        >
          <div
            class="w-20 h-20 bg-surface-100 dark:bg-surface-800 rounded-3xl flex items-center justify-center mb-6 text-surface-400"
          >
            <i class="pi pi-chart-bar text-4xl"></i>
          </div>
          <h2 class="text-2xl font-bold text-surface-900 mb-2">
            Sua análise começa aqui
          </h2>
          <p class="text-surface-600 mb-8 max-w-sm text-center">
            Nenhum gráfico disponível. Comece adicionando um novo widget para
            visualizar seus dados.
          </p>
          <p-button
            label="Criar meu primeiro gráfico"
            icon="pi pi-plus"
            (onClick)="addChart()"
            styleClass="bg-primary text-white border-none rounded-xl px-8 py-3 font-bold shadow-lg shadow-primary/20"
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
      type: 'doughnut',
      datePreset: 'this-year',
      groupBy: 'category',
      valueFilter: 'expense',
      showSummary: false,
      colSpan: 1,
    },
    {
      id: '2',
      type: 'bar',
      datePreset: 'last-month',
      groupBy: 'date',
      valueFilter: 'both',
      showSummary: true,
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
