import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { ChartCard } from './chart-card/chart-card';
import { DashboardWidget } from '../../models/dashboard-widget';

@Component({
  selector: 'app-advanced-graphics',
  standalone: true,
  imports: [CommonModule, ButtonModule, ChartCard],
  templateUrl: './advanced-graphics.html',
  styleUrls: ['./advanced-graphics.scss'],
})
export class AdvancedGraphics {
  widgets: DashboardWidget[] = [];

  constructor() {
    // Start with one default widget
    this.addWidget();
  }

  addWidget() {
    const newWidget: DashboardWidget = {
      id: `widget-${Date.now()}`,
      title: 'New Chart',
      chartType: 'bar',
      dateRange: {
        preset: 'thisMonth',
      },
      groupBy: 'category',
      filter: 'both',
      showSummary: false,
    };
    this.widgets.push(newWidget);
  }
}
