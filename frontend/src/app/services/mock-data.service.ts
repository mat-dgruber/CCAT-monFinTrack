import { Injectable } from '@angular/core';
import { DashboardWidget } from '../models/dashboard-widget';

@Injectable({
  providedIn: 'root',
})
export class MockDataService {
  constructor() {}

  getChartData(config: DashboardWidget): any {
    const labels = this.getLabels(config.dateRange);
    const data = this.getData(labels.length, config.filter);
    const backgroundColor = this.getBackgroundColors(data.length);
    const borderColor = this.getBorderColors(data.length);

    return {
      labels: labels,
      datasets: [
        {
          label: this.getLabel(config.groupBy),
          data: data,
          backgroundColor: backgroundColor,
          borderColor: borderColor,
          borderWidth: 1,
        },
      ],
    };
  }

  private getLabels(dateRange: any): string[] {
    if (dateRange.custom && dateRange.custom.start && dateRange.custom.end) {
        const start = new Date(dateRange.custom.start);
        const end = new Date(dateRange.custom.end);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 31) { // Show days
            return Array.from({length: diffDays + 1}, (_, i) => {
                const date = new Date(start);
                date.setDate(start.getDate() + i);
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            });
        } else { // Show months
            const months = [];
            let current = new Date(start);
            while (current <= end) {
                months.push(current.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }));
                current.setMonth(current.getMonth() + 1);
            }
            return months;
        }

    } else if (dateRange.preset === 'thisWeek') {
      return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    } else if (dateRange.preset === 'lastMonth') {
        return ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    } else {
      return ['January', 'February', 'March', 'April', 'May', 'June', 'July'];
    }
  }

  private getData(count: number, filter: 'income' | 'expenses' | 'both'): number[] {
    const data = [];
    for (let i = 0; i < count; i++) {
        let value = Math.floor(Math.random() * 100) + 1;
        if (filter === 'expenses') {
            value = -value;
        } else if (filter === 'both' && Math.random() > 0.5) {
            value = -value;
        }
        data.push(value);
    }
    return data;
  }

  private getBackgroundColors(count: number): string[] {
    const colors = [];
    for (let i = 0; i < count; i++) {
      colors.push(`rgba(${this.randomColor()}, ${this.randomColor()}, ${this.randomColor()}, 0.2)`);
    }
    return colors;
  }

    private getBorderColors(count: number): string[] {
        const colors = [];
        for (let i = 0; i < count; i++) {
        colors.push(`rgb(${this.randomColor()}, ${this.randomColor()}, ${this.randomColor()})`);
        }
        return colors;
    }

  private randomColor(): number {
    return Math.floor(Math.random() * 256);
  }

  private getLabel(groupBy: string): string {
    switch (groupBy) {
      case 'category':
        return 'Sales by Category';
      case 'subcategory':
        return 'Sales by Subcategory';
      case 'paymentMethod':
        return 'Sales by Payment Method';
      case 'date':
        return 'Sales by Date';
      default:
        return 'Sales';
    }
  }
}
