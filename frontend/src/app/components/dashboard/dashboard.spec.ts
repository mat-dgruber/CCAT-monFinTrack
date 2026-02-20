import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Dashboard } from './dashboard';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { DashboardService } from '../../services/dashboard.service';
import { AccountService } from '../../services/account.service';
import { ConfirmationService, MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute } from '@angular/router';
import { provideMarkdown } from 'ngx-markdown';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;
  let dashboardService: jasmine.SpyObj<DashboardService>;
  let accountService: jasmine.SpyObj<AccountService>;

  beforeEach(async () => {
    const dashboardServiceSpy = jasmine.createSpyObj('DashboardService', [
      'getSummary',
    ]);
    const accountServiceSpy = jasmine.createSpyObj('AccountService', [
      'getAccounts',
    ]);

    dashboardServiceSpy.getSummary.and.returnValue(
      of({
        total_balance: 1000,
        income_month: 500,
        expense_month: 200,
        expenses_by_category: [
          { category_name: 'Food', total: 100, color: '#000' },
        ],
        budgets: [],
        evolution: [],
      }),
    );

    accountServiceSpy.getAccounts.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [Dashboard, HttpClientTestingModule, NoopAnimationsModule],
      providers: [
        { provide: DashboardService, useValue: dashboardServiceSpy },
        { provide: AccountService, useValue: accountServiceSpy },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParams: {} }, queryParams: of({}) },
        },
        provideMarkdown(),
        ConfirmationService,
        MessageService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    dashboardService = TestBed.inject(
      DashboardService,
    ) as jasmine.SpyObj<DashboardService>;
    accountService = TestBed.inject(
      AccountService,
    ) as jasmine.SpyObj<AccountService>;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load summary and accounts on init', () => {
    expect(dashboardService.getSummary).toHaveBeenCalled();
    expect(accountService.getAccounts).toHaveBeenCalled();

    const summary = component.summary();
    expect(summary!.total_balance).toBe(1000);
    expect(summary!.income_month).toBe(500);
    expect(summary!.expense_month).toBe(200);
  });
});
