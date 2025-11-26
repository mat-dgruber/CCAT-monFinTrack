export interface DashboardWidget {
  id: string;
  title: string;
  chartType: 'pie' | 'doughnut' | 'bar' | 'line';
  dateRange: {
    preset?: 'thisMonth' | 'lastMonth' | 'thisYear' | 'thisWeek';
    custom?: {
      start: Date;
      end: Date;
    };
  };
  groupBy: 'category' | 'subcategory' | 'paymentMethod' | 'date';
  filter: 'income' | 'expenses' | 'both';
  showSummary: boolean;
  data?: any; // To be replaced with a more specific type later
}
