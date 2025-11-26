import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChartCard } from './chart-card';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { DashboardWidget } from '../../../models/dashboard-widget';

describe('ChartCard', () => {
  let component: ChartCard;
  let fixture: ComponentFixture<ChartCard>;

  const mockWidget: DashboardWidget = {
    id: 'test-widget',
    title: 'Test Chart',
    chartType: 'bar',
    dateRange: { preset: 'thisMonth' },
    groupBy: 'category',
    filter: 'both',
    showSummary: false,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChartCard, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(ChartCard);
    component = fixture.componentInstance;
    component.widget = mockWidget; // Set the widget input
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
