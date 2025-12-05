import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Dashboard } from './dashboard';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { DashboardService } from '../../services/dashboard.service';
import { AccountService } from '../../services/account.service';
import { ConfirmationService, MessageService } from 'primeng/api'; // Added
import { of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;
  let dashboardService: jasmine.SpyObj<DashboardService>;
  let accountService: jasmine.SpyObj<AccountService>;

  beforeEach(async () => {
    const dashboardServiceSpy = jasmine.createSpyObj('DashboardService', ['getSummary']);
    const accountServiceSpy = jasmine.createSpyObj('AccountService', ['getAccounts']);

    dashboardServiceSpy.getSummary.and.returnValue(of({
      total_balance: 1000,
      income_month: 500,
      expense_month: 200,
      expenses_by_category: [{ category_name: 'Food', total: 100, color: '#000' }],
      budgets: [],
      evolution: []
    }));

    accountServiceSpy.getAccounts.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [Dashboard, HttpClientTestingModule, NoopAnimationsModule],
      providers: [
        { provide: DashboardService, useValue: dashboardServiceSpy },
        { provide: AccountService, useValue: accountServiceSpy },
        ConfirmationService, // Provided
        MessageService       // Provided
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    dashboardService = TestBed.inject(DashboardService) as jasmine.SpyObj<DashboardService>;
    accountService = TestBed.inject(AccountService) as jasmine.SpyObj<AccountService>;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load summary and accounts on init', () => {
    expect(dashboardService.getSummary).toHaveBeenCalled();
    expect(accountService.getAccounts).toHaveBeenCalled();

    // Check if signals/properties are updated
    // Note: accessing private or protected signals might need type casting or just checking the template effect if we were doing integration tests.
    // Assuming component has public signals for these based on typical patterns in this project (e.g. total_balance())
    // Let's check dashboard.ts content or just assume based on template usage.
    // Since I can't see dashboard.ts completely right now, I'll rely on the signal names used in the template or previous knowledge.
    // In dashboard.spec.ts it was 'total_balance'.

    // Let's inspect component instance.
    // If signals are not public, we can't easily test them without `any` cast.
    const summary = component.summary();
    expect(summary!.total_balance).toBe(1000);
    expect(summary!.income_month).toBe(500);
    expect(summary!.expense_month).toBe(200);
  });
});
