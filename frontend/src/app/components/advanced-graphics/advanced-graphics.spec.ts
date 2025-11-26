import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdvancedGraphics } from './advanced-graphics';

describe('AdvancedGraphics', () => {
  let component: AdvancedGraphics;
  let fixture: ComponentFixture<AdvancedGraphics>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdvancedGraphics]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdvancedGraphics);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
