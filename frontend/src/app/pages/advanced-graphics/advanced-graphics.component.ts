import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { ChartWidgetComponent } from '../../components/chart-widget/chart-widget.component';
import { DashboardWidget } from '../../models/dashboard-widget.model';

@Component({
  selector: 'app-advanced-graphics',
  standalone: true,
  imports: [CommonModule, ButtonModule, ChartWidgetComponent],
  template: `
    <div class="p-6">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold text-gray-800">Gráficos Avançados</h1>
        <p-button
            label="Adicionar Gráfico"
            icon="pi pi-plus"
            (onClick)="addChart()">
        </p-button>
      </div>

      <!-- Grid Layout -->
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6 auto-rows-min">
        <div *ngFor="let widget of widgets(); let i = index" 
             class="transition-all duration-300 ease-in-out"
             [ngClass]="{
                'md:col-span-1': !widget.colSpan || widget.colSpan === 1,
                'md:col-span-2': widget.colSpan === 2,
                'h-[500px]': true
             }">
           <app-chart-widget
                [widgetConfig]="widget"
                [removeCallback]="removeWidget.bind(this)"
                (toggleSize)="toggleSize($event)">
           </app-chart-widget>
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
}