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
    <div class="p-6" #dashboardGrid>
      <div class="page-header">
        <div class="page-title-group">
          <h1 class="page-title">Gráficos Avançados</h1>
          <p class="page-description">
            Visualize seus dados financeiros com gráficos interativos e
            detalhados.
          </p>
        </div>
        <div class="page-actions w-full md:w-auto">
          <p-button (onClick)="addChart()">
            <ng-template pTemplate="content">
              <i class="pi pi-plus mr-2"></i>
              <span class="hidden md:inline">Adicionar Gráfico</span>
              <span class="md:hidden">Novo</span>
            </ng-template>
          </p-button>
        </div>
      </div>

      <!-- Global Toolbar -->
      <div
        class="mb-6 rounded-xl shadow-sm bg-surface-card p-4 flex flex-col xl:flex-row xl:items-end justify-between gap-4 border border-surface-border"
      >
        <!-- Left Side (Filters) -->
        <div class="flex flex-col md:flex-row gap-4 md:items-end w-full xl:w-auto">
          <div class="flex items-center h-full sm:mb-1">
            <span class="font-semibold text-secondary whitespace-nowrap">Filtros Globais:</span>
          </div>

          <div class="flex flex-wrap gap-3 w-full md:w-auto shrink-0">
            <!-- Período -->
            <div class="flex flex-col gap-1 flex-1 sm:flex-none min-w-[130px]">
              <label class="text-xs font-medium text-secondary">Período</label>
              <p-select
                [options]="datePresets"
                [(ngModel)]="globalDatePreset"
                optionLabel="label"
                optionValue="value"
                placeholder="Data"
                size="small"
                styleClass="w-full"
                appendTo="body"
                panelStyleClass=" "
              >
              </p-select>
            </div>

            <!-- Gráfico -->
            <div class="flex flex-col gap-1 flex-1 sm:flex-none min-w-[130px]">
              <label class="text-xs font-medium text-secondary">Gráfico</label>
              <p-select
                [options]="chartTypes"
                [(ngModel)]="globalType"
                optionLabel="label"
                optionValue="value"
                placeholder="Tipo"
                size="small"
                styleClass="w-full"
                appendTo="body"
                panelStyleClass=" "
              >
                <ng-template pTemplate="selectedItem" let-selectedOption>
                  <div class="flex items-center gap-2">
                    <span>{{ selectedOption.label }}</span>
                  </div>
                </ng-template>
                <ng-template pTemplate="item" let-item>
                  <div class="flex items-center justify-between w-full gap-2">
                    <span>{{ item.label }}</span>
                    <span
                      *ngIf="
                        item.pro &&
                        !subscriptionService.canAccess('monthly_report')
                      "
                      class="text-[10px] uppercase font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 px-2 py-0.5 rounded-full"
                      >Pro</span
                    >
                  </div>
                </ng-template>
              </p-select>
            </div>

            <!-- Valores -->
            <div class="flex flex-col gap-1 flex-1 sm:flex-none min-w-[130px]">
              <label class="text-xs font-medium text-secondary">Valores</label>
              <p-select
                [options]="valueFilterOptions"
                [(ngModel)]="globalValueFilter"
                optionLabel="label"
                optionValue="value"
                placeholder="Filtrar Valor"
                size="small"
                styleClass="w-full"
                appendTo="body"
                panelStyleClass=" "
              >
              </p-select>
            </div>

            <!-- Agrupamento -->
            <div class="flex flex-col gap-1 flex-1 sm:flex-none min-w-[130px]">
              <label class="text-xs font-medium text-secondary">Agrupamento</label>
              <p-select
                [options]="groupingOptions"
                [(ngModel)]="globalGroupBy"
                optionLabel="label"
                optionValue="value"
                placeholder="Agrupar"
                size="small"
                styleClass="w-full"
                appendTo="body"
                panelStyleClass=" "
              >
              </p-select>
            </div>
          </div>

          <p-button
            label="Aplicar a Todos"
            icon="pi pi-check"
            size="small"
            (onClick)="applyGlobalFilters()"
            [outlined]="true"
            styleClass="w-full md:w-auto px-4"
          >
          </p-button>
        </div>

        <!-- Right Side (Exports) -->
        <div class="flex flex-wrap gap-2 w-full xl:w-auto justify-end">
          <p-button
            label="Exportar CSV"
            icon="pi pi-file-excel"
            size="small"
            severity="secondary"
            (onClick)="exportAllCSV()"
            [disabled]="!subscriptionService.canAccess('monthly_report')"
            [pTooltip]="
              !subscriptionService.canAccess('monthly_report')
                ? 'Disponível no plano PRO'
                : ''
            "
            styleClass="w-full sm:w-auto px-4"
          >
          </p-button>
          <p-button
            *ngIf="!subscriptionService.canAccess('monthly_report')"
            label="Desbloquear Pro"
            icon="pi pi-lock-open"
            size="small"
            (onClick)="navigateToPricing()"
            styleClass="w-full sm:w-auto px-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-none"
          >
          </p-button>
        </div>
      </div>

      <!-- Grid Layout -->
      <div
        class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6 auto-rows-min"
      >
        @for (widget of widgets(); track widget.id; let i = $index) {
          <div
            class="transition-all duration-300 ease-in-out"
            [ngClass]="{
              'md:col-span-1': !widget.colSpan || widget.colSpan === 1,
              'md:col-span-2': widget.colSpan === 2,
              'h-[500px]': true,
              'opacity-50': draggedIndex === i,
              'border-2 border-dashed border-blue-400 rounded-lg':
                draggedIndex === i,
            }"
            [draggable]="draggedIndex === i || hoveredIndex === i"
            (dragstart)="onDragStart(i)"
            (dragover)="onDragOver($event, i)"
            (drop)="onDrop(i)"
            (dragend)="onDragEnd()"
          >
            <div class="h-full relative group">
              <!-- Drag Handle Overlay (Visible on Hover) -->
              <div
                class="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-4 bg-gray-200 dark:bg-gray-700 rounded-b-md cursor-move z-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                title="Arrastar para reordenar"
                (mouseenter)="hoveredIndex = i"
                (mouseleave)="hoveredIndex = null"
              >
                <i class="pi pi-bars text-[10px] text-secondary"></i>
              </div>

              <app-chart-widget
                [widgetConfig]="widget"
                [removeCallback]="removeWidget.bind(this)"
                (toggleSize)="toggleSize($event)"
              >
              </app-chart-widget>
            </div>
          </div>
        }
      </div>

      @if (widgets().length === 0) {
        <div
          class="text-center py-20 bg-surface-hover rounded-lg border-2 border-dashed border-surface-border"
        >
          <p class="text-secondary mb-4">Nenhum gráfico configurado.</p>
          <p-button
            label="Criar seu primeiro gráfico"
            (onClick)="addChart()"
            severity="secondary"
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
