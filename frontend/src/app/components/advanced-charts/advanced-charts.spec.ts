import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdvancedCharts } from './advanced-charts';

describe('AdvancedCharts', () => {
  let component: AdvancedCharts;
  let fixture: ComponentFixture<AdvancedCharts>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdvancedCharts]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdvancedCharts);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
