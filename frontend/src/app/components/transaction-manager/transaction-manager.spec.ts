import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TransactionManager } from './transaction-manager';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TransactionService } from '../../services/transaction.service';
import { CategoryService } from '../../services/category.service';
import { AccountService } from '../../services/account.service';
import { ConfirmationService, MessageService } from 'primeng/api';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { Transaction } from '../../models/transaction.model';
import { Category } from '../../models/category.model';
import { Account } from '../../models/account.model';

describe('TransactionManager', () => {
  let component: TransactionManager;
  let fixture: ComponentFixture<TransactionManager>;
  let transactionService: jasmine.SpyObj<TransactionService>;

  const mockTransactions: Transaction[] = [
    {
      id: '1',
      description: 'Compra Supermercado',
      amount: 150.00,
      date: '2023-10-27',
      type: 'expense',
      payment_method: 'credit_card',
      category: { id: 'c1', name: 'Alimentação', icon: 'pi pi-apple', color: 'red', type: 'expense', is_custom: false },
      account: { id: 'a1', name: 'Conta Corrente', type: 'checking', balance: 1000, color: 'blue' },
      category_id: 'c1',
      account_id: 'a1'
    },
    {
      id: '2',
      description: 'Salário',
      amount: 5000.00,
      date: '2023-10-05',
      type: 'income',
      payment_method: 'bank_transfer',
      category: { id: 'c2', name: 'Salário', icon: 'pi pi-money-bill', color: 'green', type: 'income', is_custom: false },
      account: { id: 'a1', name: 'Conta Corrente', type: 'checking', balance: 1000, color: 'blue' },
      category_id: 'c2',
      account_id: 'a1'
    },
    {
      id: '3',
      description: 'Uber',
      amount: 25.00,
      date: '2023-10-28',
      type: 'expense',
      payment_method: 'credit_card',
      category: { id: 'c3', name: 'Transporte', icon: 'pi pi-car', color: 'blue', type: 'expense', is_custom: false },
      account: { id: 'a2', name: 'Cartão Nubank', type: 'credit_card', balance: 0, color: 'purple' },
      category_id: 'c3',
      account_id: 'a2'
    }
  ];

  beforeEach(async () => {
    const transactionServiceSpy = jasmine.createSpyObj('TransactionService', ['getTransactions', 'deleteTransaction']);
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
    expect(component.transactions().length).toBe(3);
  });

  it('should filter by description', () => {
    component.filterDescription.set('supermercado');
    const filtered = component.filteredTransactions();
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('1');
  });

  it('should filter by payment method', () => {
    component.filterPaymentMethod.set('credit_card');
    const filtered = component.filteredTransactions();
    expect(filtered.length).toBe(2); // Items 1 and 3
    expect(filtered.find(t => t.id === '1')).toBeTruthy();
    expect(filtered.find(t => t.id === '3')).toBeTruthy();
  });

  it('should clear filters', () => {
    // Set some filters
    component.filterDescription.set('Something');
    component.filterPaymentMethod.set('pix');
    
    // Clear
    component.clearFilters();

    expect(component.filterDescription()).toBe('');
    expect(component.filterPaymentMethod()).toBeNull();
    expect(transactionService.getTransactions).toHaveBeenCalledTimes(2); // Once on init, once on clear
  });
});
