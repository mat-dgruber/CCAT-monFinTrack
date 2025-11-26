import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardWidget } from '../../../models/dashboard-widget';
import { MockDataService } from '../../../services/mock-data.service';

// PrimeNG Modules
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { ToolbarModule } from 'primeng/toolbar';

@Component({
  selector: 'app-chart-card',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    ChartModule,
    SelectModule,
    DatePickerModule,
    SelectButtonModule,
    ToggleButtonModule,
    ToolbarModule,
  ],
  templateUrl: './chart-card.html',
  styleUrls: ['./chart-card.scss'],
})
export class ChartCard implements OnInit {
  @Input() widget!: DashboardWidget;

  // Chart data and options
  data: any;
  options: any;
  summaryData: any;

  // Options for dropdowns
  chartTypeOptions: any[];
  periodOptions: any[];
  groupByOptions: any[];
  filterOptions: any[];

  constructor(private mockDataService: MockDataService) {
    this.chartTypeOptions = [
      { label: 'Bar', value: 'bar', icon: 'pi pi-chart-bar' },
      { label: 'Line', value: 'line', icon: 'pi pi-chart-line' },
      { label: 'Pie', value: 'pie', icon: 'pi pi-chart-pie' },
      { label: 'Doughnut', value: 'doughnut', icon: 'pi pi-chart-doughnut' },
    ];

    this.periodOptions = [
      { label: 'This Month', value: 'thisMonth' },
      { label: 'Last Month', value: 'lastMonth' },
      { label: 'This Year', value: 'thisYear' },
      { label: 'This Week', value: 'thisWeek' },
    ];

    this.groupByOptions = [
        { label: 'Category', value: 'category' },
        { label: 'Subcategory', value: 'subcategory' },
        { label: 'Payment Method', value: 'paymentMethod' },
        { label: 'Date', value: 'date' },
    ];

    this.filterOptions = [
        { label: 'Both', value: 'both' },
        { label: 'Income', value: 'income' },
        { label: 'Expenses', value: 'expenses' },
    ];
  }

  ngOnInit() {
    this.updateChart();
  }

  updateChart() {
    this.data = this.mockDataService.getChartData(this.widget);
    this.calculateSummary();
    const documentStyle = getComputedStyle(document.documentElement);
    const textColor = documentStyle.getPropertyValue('--text-color');
    const textColorSecondary = documentStyle.getPropertyValue('--text-color-secondary');
    const surfaceBorder = documentStyle.getPropertyValue('--surface-border');

    this.options = {
        plugins: {
            legend: {
                labels: {
                    color: textColor
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    color: textColorSecondary
                },
                grid: {
                    color: surfaceBorder,
                    drawBorder: false
                }
            },
            x: {
                ticks: {
                    color: textColorSecondary
                },
                grid: {
                    color: surfaceBorder,
                    drawBorder: false
                }
            }
        }
    };
  }

  onConfigChange() {
    // A function to call when any filter changes
    console.log('Configuration changed:', this.widget);
    this.updateChart();
  }

  calculateSummary() {
    if (this.data && this.data.datasets && this.data.datasets[0]) {
      const values = this.data.datasets[0].data;
      const total = values.reduce((acc: number, val: number) => acc + val, 0);
      this.summaryData = {
        transactions: values.length,
        totalValue: total.toFixed(2),
        average: (total / values.length).toFixed(2),
        firstTransaction: '2023-01-01', // Mock data
        lastTransaction: '2023-01-31', // Mock data
      };
    }
  }
}
