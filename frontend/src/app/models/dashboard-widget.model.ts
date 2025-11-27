export type WidgetType = 'pie' | 'doughnut' | 'bar' | 'line' | 'heatmap' | 'treemap' | 'boxplot';
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
}
