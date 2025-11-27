import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Dashboard } from './dashboard';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should update chart type and setup chart on type change', () => {
    // Mock summary data since setupChart depends on it
    component.summary.set({
      total_balance: 1000,
      income_month: 500,
      expense_month: 200,
      expenses_by_category: [
        { category_name: 'Food', total: 100, color: '#000' }
      ],
      budgets: []
    });

    spyOn(component, 'setupChart').and.callThrough();

    // Simulate change
    component.onChartTypeChange('bar');

    expect(component.chartType()).toBe('bar');
    expect(component.setupChart).toHaveBeenCalled();
    // When type is 'bar', scales should be defined in options
    expect(component.chartOptions.scales).toBeDefined();
  });
});
