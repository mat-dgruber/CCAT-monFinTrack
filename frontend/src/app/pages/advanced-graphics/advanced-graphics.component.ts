import { Component, signal, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { ToolbarModule } from 'primeng/toolbar';
import { ChartWidgetComponent } from '../../components/chart-widget/chart-widget.component';
import { DashboardWidget, DateRangePreset, WidgetType } from '../../models/dashboard-widget.model';
import html2canvas from 'html2canvas';

@Component({
  selector: 'app-advanced-graphics',
  standalone: true,
  imports: [CommonModule, ButtonModule, ChartWidgetComponent, FormsModule, SelectModule, ToolbarModule],
  template: `
    <div class="p-6" #dashboardGrid>
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold text-gray-800">Gráficos Avançados</h1>
        <div class="flex gap-2">
            <p-button
                label="Adicionar Gráfico"
                icon="pi pi-plus"
                (onClick)="addChart()">
            </p-button>
        </div>
      </div>

      <!-- Global Toolbar -->
      <p-toolbar styleClass="mb-6 rounded-xl border-none shadow-sm bg-white">
          <div class="p-toolbar-group-start flex gap-4 items-center flex-wrap">
              <span class="font-semibold text-gray-600">Filtros Globais:</span>
              
              <p-select 
                  [options]="datePresets" 
                  [(ngModel)]="globalDatePreset" 
                  optionLabel="label" 
                  optionValue="value" 
                  placeholder="Data"
                  size="small"
                  styleClass="w-40">
              </p-select>

              <p-select 
                  [options]="chartTypes" 
                  [(ngModel)]="globalType" 
                  optionLabel="label" 
                  optionValue="value" 
                  placeholder="Tipo"
                  size="small"
                  styleClass="w-40">
              </p-select>

              <p-button 
                  label="Aplicar a Todos" 
                  icon="pi pi-check" 
                  size="small" 
                  (onClick)="applyGlobalFilters()"
                  [outlined]="true">
              </p-button>
          </div>

           <div class="p-toolbar-group-end flex gap-2">
              <p-button 
                  label="Exportar PNG" 
                  icon="pi pi-image" 
                  size="small" 
                  severity="secondary"
                  (onClick)="exportAllPNG()">
              </p-button>
               <p-button 
                  label="Exportar CSV" 
                  icon="pi pi-file-excel" 
                  size="small" 
                  severity="secondary"
                  (onClick)="exportAllCSV()">
              </p-button>
          </div>
      </p-toolbar>

      <!-- Grid Layout -->
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6 auto-rows-min">
        <div *ngFor="let widget of widgets(); let i = index" 
             class="transition-all duration-300 ease-in-out"
             [ngClass]="{
                'md:col-span-1': !widget.colSpan || widget.colSpan === 1,
                'md:col-span-2': widget.colSpan === 2,
                'h-[500px]': true,
                'opacity-50': draggedIndex === i,
                'border-2 border-dashed border-blue-400 rounded-lg': draggedIndex === i
             }"
             draggable="true"
             (dragstart)="onDragStart(i)"
             (dragover)="onDragOver($event, i)"
             (drop)="onDrop(i)"
             (dragend)="onDragEnd()">
           
           <div class="h-full relative group">
               <!-- Drag Handle Overlay (Visible on Hover) -->
               <div class="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-4 bg-gray-200 rounded-b-md cursor-move z-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center" title="Arrastar para reordenar">
                   <i class="pi pi-bars text-[10px] text-gray-500"></i>
               </div>

               <app-chart-widget
                    [widgetConfig]="widget"
                    [removeCallback]="removeWidget.bind(this)"
                    (toggleSize)="toggleSize($event)">
               </app-chart-widget>
           </div>
        </div>
      </div>

      <div *ngIf="widgets().length === 0" class="text-center py-20 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p class="text-gray-500 mb-4">Nenhum gráfico configurado.</p>
          <p-button label="Criar seu primeiro gráfico" (onClick)="addChart()" severity="secondary"></p-button>
      </div>
    </div>
  `
})
export class AdvancedGraphicsComponent {
  @ViewChild('dashboardGrid') dashboardGrid!: ElementRef;

  widgets = signal<DashboardWidget[]>([
    {
      id: '1',
      type: 'doughnut',
      datePreset: 'this-year',
      groupBy: 'category',
      valueFilter: 'expense',
      showSummary: false,
      colSpan: 1
    },
    {
      id: '2',
      type: 'bar',
      datePreset: 'last-month',
      groupBy: 'date',
      valueFilter: 'both',
      showSummary: true,
      colSpan: 1
    }
  ]);

  globalDatePreset: string = 'none';
  globalType: string = 'none';

  // Drag & Drop State
  draggedIndex: number | null = null;

  datePresets = [
    { label: 'Sem Alteração', value: 'none' },
    { label: 'Esse Mês', value: 'this-month' },
    { label: 'Mês Passado', value: 'last-month' },
    { label: 'Esse Ano', value: 'this-year' },
    { label: 'Essa Semana', value: 'this-week' }
  ];

  chartTypes = [
    { label: 'Sem Alteração', value: 'none' },
    { label: 'Pizza', value: 'pie' },
    { label: 'Rosca', value: 'doughnut' },
    { label: 'Barras', value: 'bar' },
    { label: 'Linha', value: 'line' },
    { label: 'Treemap', value: 'treemap' },
    { label: 'Box Plot', value: 'boxplot' },
    { label: 'Sankey', value: 'sankey' }
  ];

  applyGlobalFilters() {
    this.widgets.update(widgets => widgets.map(w => {
      let newW = { ...w };
      if (this.globalDatePreset !== 'none') {
        newW.datePreset = this.globalDatePreset as DateRangePreset;
      }
      if (this.globalType !== 'none') {
        newW.type = this.globalType as WidgetType;
      }
      return newW;
    }));
  }

  addChart() {
    const newWidget: DashboardWidget = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'bar', // Default
      datePreset: 'this-month',
      groupBy: 'category',
      valueFilter: 'both',
      showSummary: false,
      colSpan: 1
    };

    this.widgets.update(widgets => [...widgets, newWidget]);
  }

  removeWidget(id: string) {
    this.widgets.update(widgets => widgets.filter(w => w.id !== id));
  }

  toggleSize(id: string) {
    this.widgets.update(widgets => widgets.map(w => {
      if (w.id === id) {
        return { ...w, colSpan: w.colSpan === 2 ? 1 : 2 };
      }
      return w;
    }));
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

    this.widgets.update(widgets => {
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
  exportAllPNG() {
    if (this.dashboardGrid) {
      html2canvas(this.dashboardGrid.nativeElement).then(canvas => {
        const link = document.createElement('a');
        link.download = `dashboard-export-${new Date().toISOString().slice(0, 10)}.png`;
        link.href = canvas.toDataURL();
        link.click();
      });
    }
  }

  exportAllCSV() {
    // Create a summary CSV of all widgets configuration
    const headers = ['ID', 'Tipo', 'Período', 'Agrupamento', 'Filtro Valor', 'Resumo Ativo'];
    const rows = this.widgets().map(w => [
      w.id,
      w.type,
      w.datePreset,
      w.groupBy,
      w.valueFilter,
      w.showSummary ? 'Sim' : 'Não'
    ]);

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += headers.join(";") + "\n";
    rows.forEach(row => {
      csvContent += row.join(";") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `dashboard-config-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}