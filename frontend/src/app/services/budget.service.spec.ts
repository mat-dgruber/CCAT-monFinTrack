import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { BudgetService } from './budget.service';
import { Budget } from '../models/budget.model';
import { environment } from '../../environments/environment';

describe('BudgetService', () => {
  let service: BudgetService;
  let httpMock: HttpTestingController;
  const apiUrl = `${environment.apiUrl}/budgets`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [BudgetService]
    });
    service = TestBed.inject(BudgetService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should retrieve budgets with progress', () => {
    const dummyBudgets: Budget[] = [
      { id: '1', amount: 100, spent: 50, percentage: 50, category_id: 'c1' } as Budget
    ];

    service.getBudgets(1, 2023).subscribe(budgets => {
      expect(budgets.length).toBe(1);
      expect(budgets).toEqual(dummyBudgets);
    });

    const req = httpMock.expectOne(`${apiUrl}?month=1&year=2023`);
    expect(req.request.method).toBe('GET');
    req.flush(dummyBudgets);
  });

  it('should create a budget', () => {
    const newBudget: Budget = { category_id: 'c1', amount: 500 } as Budget;
    const responseBudget: Budget = { ...newBudget, id: '123' };

    service.createBudget(newBudget).subscribe(budget => {
      expect(budget).toEqual(responseBudget);
    });

    const req = httpMock.expectOne(apiUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(newBudget);
    req.flush(responseBudget);
  });

  it('should update a budget', () => {
    const budgetId = '123';
    const updateData: Budget = { id: budgetId, amount: 600 } as Budget;

    service.updateBudget(budgetId, updateData).subscribe(budget => {
      expect(budget).toEqual(updateData);
    });

    const req = httpMock.expectOne(`${apiUrl}/${budgetId}`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(updateData);
    req.flush(updateData);
  });

  it('should delete a budget', () => {
    const budgetId = '123';

    service.deleteBudget(budgetId).subscribe(res => {
      expect(res).toBeNull(); // Void return usually maps to null in observable result if empty body?
    });

    const req = httpMock.expectOne(`${apiUrl}/${budgetId}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null); // Return empty body
  });
});
