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
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
