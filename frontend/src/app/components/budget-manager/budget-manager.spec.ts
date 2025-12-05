import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BudgetManager } from './budget-manager';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ConfirmationService, MessageService } from 'primeng/api';

describe('BudgetManager', () => {
  let component: BudgetManager;
  let fixture: ComponentFixture<BudgetManager>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BudgetManager, HttpClientTestingModule, NoopAnimationsModule],
      providers: [ConfirmationService, MessageService]
    })
      .compileComponents();

    fixture = TestBed.createComponent(BudgetManager);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
