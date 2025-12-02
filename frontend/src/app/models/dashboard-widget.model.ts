export type WidgetType = 'pie' | 'doughnut' | 'bar' | 'line' | 'heatmap' | 'treemap' | 'boxplot' | 'sankey';
export type DateRangePreset = 'this-month' | 'last-month' | 'this-year' | 'this-week' | 'custom';
export type GroupingOption = 'category' | 'subcategory' | 'payment-method' | 'date';
export type ValueFilter = 'income' | 'expense' | 'both';

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  datePreset: DateRangePreset;
  customDateRange?: Date[]; // For p-datepicker range selection
  groupBy: GroupingOption;
  valueFilter: ValueFilter;
  showSummary: boolean;
  title?: string;
  colSpan?: number; // 1 or 2

  // New Features
  compareWithPrevious?: boolean;
  showForecast?: boolean;
  enableDrillDown?: boolean;
}
