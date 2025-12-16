import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TransactionService } from './transaction.service';
import { Transaction } from '../models/transaction.model';
import { environment } from '../../environments/environment';

describe('TransactionService', () => {
  let service: TransactionService;
  let httpMock: HttpTestingController;
  const apiUrl = `${environment.apiUrl}/transactions`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [TransactionService]
    });
    service = TestBed.inject(TransactionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should get transactions with query params', () => {
    const dummyTransactions: Transaction[] = [{ id: 't1', title: 'Test' } as Transaction];

    service.getTransactions(1, 2023, 10, '2023-01-01', '2023-01-31').subscribe(trans => {
      expect(trans).toEqual(dummyTransactions);
    });

    // Order of params depends on implementation construction
    const req = httpMock.expectOne(req => req.url === apiUrl && req.params.has('month'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('month')).toBe('1');
    expect(req.request.params.get('year')).toBe('2023');
    expect(req.request.params.get('limit')).toBe('10');
    expect(req.request.params.get('start_date')).toBe('2023-01-01');
    expect(req.request.params.get('end_date')).toBe('2023-01-31');
    
    req.flush(dummyTransactions);
  });

  it('should create a transaction', () => {
    const newTrans: Transaction = { title: 'New' } as Transaction;
    const responseTrans: Transaction = { ...newTrans, id: '123' };

    service.createTransaction(newTrans).subscribe(trans => {
      expect(trans).toEqual(responseTrans);
    });

    const req = httpMock.expectOne(apiUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(newTrans);
    req.flush(responseTrans);
  });

  it('should update a transaction', () => {
    const id = '123';
    const updateData: Partial<Transaction> = { title: 'Updated' };
    const responseTrans = { id, title: 'Updated' } as Transaction;

    service.updateTransaction(id, updateData).subscribe(trans => {
      expect(trans).toEqual(responseTrans);
    });

    const req = httpMock.expectOne(`${apiUrl}/${id}`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(updateData);
    req.flush(responseTrans);
  });

  it('should delete a transaction', () => {
    const id = '123';

    service.deleteTransaction(id).subscribe();

    const req = httpMock.expectOne(`${apiUrl}/${id}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
  
  it('should get upcoming transactions', () => {
      const dummyTransactions: Transaction[] = [{ id: 't1', title: 'Upcoming' } as Transaction];
      const limit = 5;
      
      service.getUpcomingTransactions(limit).subscribe(trans => {
          expect(trans).toEqual(dummyTransactions);
      });
      
      const req = httpMock.expectOne(`${apiUrl}/upcoming?limit=${limit}`);
      expect(req.request.method).toBe('GET');
      req.flush(dummyTransactions);
  });
});
