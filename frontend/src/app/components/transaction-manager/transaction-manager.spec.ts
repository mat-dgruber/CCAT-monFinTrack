import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TransactionManager } from './transaction-manager';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TransactionService } from '../../services/transaction.service';
import { CategoryService } from '../../services/category.service';
import { AccountService } from '../../services/account.service';
import { ConfirmationService, MessageService } from 'primeng/api';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { Transaction } from '../../models/transaction.model';
import { Table } from 'primeng/table';

// Register locale data
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
registerLocaleData(localePt);

describe('TransactionManager', () => {
  let component: TransactionManager;
  let fixture: ComponentFixture<TransactionManager>;
  let transactionService: jasmine.SpyObj<TransactionService>;

  const mockTransactions: any[] = [
    {
      id: '1',
      description: 'Compra Supermercado',
      amount: 150.00,
      date: '2023-10-27',
      type: 'expense',
      payment_method: 'credit_card',
      category: { id: 'c1', name: 'Alimentação', icon: 'pi pi-apple', color: 'red', type: 'expense', is_custom: false },
      account: { id: 'a1', name: 'Conta Corrente', type: 'checking', balance: 1000, color: 'blue' }
    },
    {
      id: '2',
      description: 'Salário',
      amount: 5000.00,
      date: '2023-10-05',
      type: 'income',
      payment_method: 'bank_transfer',
      category: { id: 'c2', name: 'Salário', icon: 'pi pi-money-bill', color: 'green', type: 'income', is_custom: false },
      account: { id: 'a1', name: 'Conta Corrente', type: 'checking', balance: 1000, color: 'blue' }
    }
  ];

  beforeEach(async () => {
    const transactionServiceSpy = jasmine.createSpyObj('TransactionService', ['getTransactions', 'deleteTransaction', 'updateTransaction']);
    const categoryServiceSpy = jasmine.createSpyObj('CategoryService', ['getCategories']);
    const accountServiceSpy = jasmine.createSpyObj('AccountService', ['getAccounts']);

    transactionServiceSpy.getTransactions.and.returnValue(of(mockTransactions));
    categoryServiceSpy.getCategories.and.returnValue(of([]));
    accountServiceSpy.getAccounts.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [TransactionManager, HttpClientTestingModule, NoopAnimationsModule],
      providers: [
        { provide: TransactionService, useValue: transactionServiceSpy },
        { provide: CategoryService, useValue: categoryServiceSpy },
        { provide: AccountService, useValue: accountServiceSpy },
        ConfirmationService,
        MessageService
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TransactionManager);
    component = fixture.componentInstance;
    transactionService = TestBed.inject(TransactionService) as jasmine.SpyObj<TransactionService>;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load data on init', () => {
    expect(transactionService.getTransactions).toHaveBeenCalled();
    expect(component.transactions().length).toBe(2);
  });

  it('should handle date range change', () => {
    const start = new Date('2023-01-01');
    const end = new Date('2023-01-31');
    component.filterDateRange.set([start, end]);

    component.onDateRangeChange();

    expect(transactionService.getTransactions).toHaveBeenCalledWith(undefined, undefined, undefined, start.toISOString(), end.toISOString());
  });

  it('should clear filters', () => {
    // Mock Table
    const tableSpy = jasmine.createSpyObj('Table', ['clear']);
    component.filterDateRange.set([new Date(), new Date()]);

    component.clear(tableSpy);

    expect(tableSpy.clear).toHaveBeenCalled();
    expect(component.filterDateRange()).toBeNull();
    expect(transactionService.getTransactions).toHaveBeenCalled();
  });

  it('should handle error on load', () => {
    transactionService.getTransactions.and.returnValue(throwError(() => new Error('Error')));
    component.loadData();
    expect(component.loading()).toBeFalse();
    // Verify message service call if possible, but it requires spying on MessageService in beforeEach
    // We didn't spy on it, but provided it. To test it we would need to spy.
  });

  it('should delete transaction', () => {
    const t = mockTransactions[0];

    // Mock ConfirmationService
    // Since we provided ConfirmationService, we can modify how it works? 
    // Actually we injected the real service? No, we provided it in providers array, so it is the real one or a mock if we provided one.
    // In TestBed specific providers usually override.
    // Ideally we spy on confirmationService.confirm

    // Let's rely on deleteTransaction call.
    // The component calls confirmationService.confirm. The accept callback calls service.delete.
    // Testing this requires mocking the confirm method to immediately call accept.

    // For now, let's skip complex interaction test or assume it's covered by manual testing.
    // Or we can mock the private service by casting.

    const confirmationService = TestBed.inject(ConfirmationService);
    spyOn(confirmationService, 'confirm').and.callFake((config: any) => {
      config.accept();
      return this as any; // return type fix
    });

    transactionService.deleteTransaction.and.returnValue(of(void 0));

    component.deleteTransaction({ target: {} } as any, t);

    expect(transactionService.deleteTransaction).toHaveBeenCalledWith(t.id);
  });
});
