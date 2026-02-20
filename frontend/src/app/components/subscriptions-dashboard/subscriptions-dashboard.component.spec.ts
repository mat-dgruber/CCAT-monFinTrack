import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SubscriptionsDashboardComponent } from './subscriptions-dashboard.component';
import { RecurrenceService } from '../../services/recurrence.service';
import { TransactionService } from '../../services/transaction.service';
import { CategoryService } from '../../services/category.service';
import { AccountService } from '../../services/account.service';
import { ConfirmationService, MessageService } from 'primeng/api';
import { of } from 'rxjs';
import {
  Recurrence,
  RecurrencePeriodicity,
} from '../../models/recurrence.model';
import { DatePickerModule } from 'primeng/datepicker';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { AIService } from '../../services/ai.service';
import { SubscriptionService } from '../../services/subscription.service';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute } from '@angular/router';

describe('SubscriptionsDashboardComponent', () => {
  let component: SubscriptionsDashboardComponent;
  let fixture: ComponentFixture<SubscriptionsDashboardComponent>;
  let recurrenceServiceSpy: jasmine.SpyObj<RecurrenceService>;
  let confirmationServiceSpy: jasmine.SpyObj<ConfirmationService>;
  let transactionServiceSpy: jasmine.SpyObj<TransactionService>;

  beforeEach(async () => {
    const recSpy = jasmine.createSpyObj('RecurrenceService', [
      'getRecurrences',
      'createRecurrence',
      'updateRecurrence',
    ]);
    const txSpy = jasmine.createSpyObj('TransactionService', [
      'getTransactions',
      'createTransaction',
    ]);
    const catSpy = jasmine.createSpyObj('CategoryService', ['getCategories']);
    const accSpy = jasmine.createSpyObj('AccountService', ['getAccounts']);
    const confirmSpy = jasmine.createSpyObj('ConfirmationService', ['confirm']);
    const msgSpy = jasmine.createSpyObj('MessageService', ['add']);
    const aiSpy = jasmine.createSpyObj('AIService', [
      'getSubscriptionSuggestions',
    ]);
    const subSpy = jasmine.createSpyObj('SubscriptionService', ['canAccess']);

    // Mock returns
    recSpy.getRecurrences.and.returnValue(of([]));
    txSpy.getTransactions.and.returnValue(of([]));
    catSpy.getCategories.and.returnValue(of([]));
    accSpy.getAccounts.and.returnValue(of([]));
    aiSpy.getSubscriptionSuggestions.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [
        SubscriptionsDashboardComponent,
        DatePickerModule,
        ConfirmDialogModule,
        NoopAnimationsModule,
      ],
      providers: [
        { provide: RecurrenceService, useValue: recSpy },
        { provide: TransactionService, useValue: txSpy },
        { provide: CategoryService, useValue: catSpy },
        { provide: AccountService, useValue: accSpy },
        { provide: ConfirmationService, useValue: confirmSpy },
        { provide: MessageService, useValue: msgSpy },
        { provide: AIService, useValue: aiSpy },
        { provide: SubscriptionService, useValue: subSpy },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParams: {} }, queryParams: of({}) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SubscriptionsDashboardComponent);
    component = fixture.componentInstance;
    recurrenceServiceSpy = TestBed.inject(
      RecurrenceService,
    ) as jasmine.SpyObj<RecurrenceService>;
    confirmationServiceSpy = TestBed.inject(
      ConfirmationService,
    ) as jasmine.SpyObj<ConfirmationService>;
    transactionServiceSpy = TestBed.inject(
      TransactionService,
    ) as jasmine.SpyObj<TransactionService>;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('projectedRecurrences should include retroactive item based on start_date', () => {
    const today = new Date(); // e.g., 2026-02-02

    // Create a retroactive recurrence: created today, but start_date in 2024
    const retroactiveRec: Recurrence = {
      id: '1',
      name: 'Retro Sub',
      amount: 10,
      active: true,
      category_id: '1',
      account_id: '1',
      periodicity: RecurrencePeriodicity.MONTHLY,
      due_day: 1,
      start_date: new Date('2024-01-01'), // Old start date
      created_at: today, // Created just now
      user_id: 'test_user',
      auto_pay: false,
    };

    // Set recurrences signal
    component.recurrences.set([retroactiveRec]);

    // Set view date to a past date (e.g. Feb 2024)
    component.currentDate.set(new Date('2024-02-15'));

    // Trigger computation
    const projected = component.projectedRecurrences();

    // It SHOULD appear because start_date (2024-01-01) < endOfMonth (Feb 2024)
    // If it used created_at (2026), it would NOT appear.
    expect(projected.length).toBe(1);
    expect(projected[0].name).toBe('Retro Sub');
  });

  it('saveRecurrence should show "Only This" confirmation when editingInstanceDate is set', () => {
    component.isEditMode = true;
    component.currentRecurrenceId = 'rec1';
    component.editingInstanceDate = new Date('2025-03-01');
    component.recurrenceForm.patchValue({
      name: 'Updated Name',
      amount: 100,
      category_id: 'cat1',
      account_id: 'acc1',
      payment_method_id: 'pix',
      due_day: 1,
      periodicity: RecurrencePeriodicity.MONTHLY,
    });

    component.saveRecurrence();

    expect(confirmationServiceSpy.confirm).toHaveBeenCalled();
    const callArgs = confirmationServiceSpy.confirm.calls.mostRecent().args[0];

    // Verify accept/reject labels or message contain "Only This" logic clues
    expect(callArgs.acceptLabel).toBe('Apenas Esta');
    expect(callArgs.rejectLabel).toBe('Desta em diante (Recorrência)');
  });

  it('should call createTransactionOverride when "Only This" is accepted', () => {
    // We need to simulate the accept callback of the confirm dialog
    // We can't easily trigger the callback via spy, but we can call createTransactionOverride directly to test it,
    // OR we can mock the spy to execute the accept function.

    // Let's test createTransactionOverride directly as unit test of that method
    const recId = 'rec1';
    const formVal = {
      name: 'Instance Override',
      amount: 50,
      payment_method_id: 'pix',
      category_id: 'cat1',
      account_id: 'acc1',
    };
    const date = new Date('2025-03-01');

    transactionServiceSpy.createTransaction.and.returnValue(of({} as any));

    component.selectedType = 'expense';
    component.createTransactionOverride(recId, formVal, date);

    expect(transactionServiceSpy.createTransaction).toHaveBeenCalled();
    const payload =
      transactionServiceSpy.createTransaction.calls.mostRecent().args[0];

    expect(payload.recurrence_id).toBe(recId);
    expect(payload.date).toBe(date);
    expect(payload.amount).toBe(50);
    expect(payload.title).toContain('Instance Override');
  });
});
