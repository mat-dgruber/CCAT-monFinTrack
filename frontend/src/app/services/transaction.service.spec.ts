import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TransactionService } from './transaction.service';
import { environment } from '../../environments/environment';
import { Transaction } from '../models/transaction.model';

describe('TransactionService', () => {
     let service: TransactionService;
     let httpMock: HttpTestingController;

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

     it('should retrieve transactions with query parameters', () => {
          const mockTransactions: any[] = [
               { id: '1', description: 'Test', amount: 100, date: '2023-01-01', type: 'expense', payment_method: 'card', category_id: 'c1', account_id: 'a1' }
          ];

          service.getTransactions(1, 2023, 10).subscribe(transactions => {
               expect(transactions.length).toBe(1);
               expect(transactions).toEqual(mockTransactions);
          });

          const req = httpMock.expectOne(`${environment.apiUrl}/transactions?month=1&year=2023&limit=10&`);
          expect(req.request.method).toBe('GET');
          req.flush(mockTransactions);
     });

     it('should create a transaction via POST', () => {
          const newTransaction: any = {
               description: 'New Transaction',
               amount: 50,
               date: '2023-01-02',
               type: 'income',
               payment_method: 'pix',
               category_id: 'c2',
               account_id: 'a2'
          };

          service.createTransaction(newTransaction).subscribe(transaction => {
               expect(transaction).toEqual({ ...newTransaction, id: '123' });
          });

          const req = httpMock.expectOne(`${environment.apiUrl}/transactions`);
          expect(req.request.method).toBe('POST');
          expect(req.request.body).toEqual(newTransaction);
          req.flush({ ...newTransaction, id: '123' });
     });

     it('should update a transaction via PUT', () => {
          const transactionId = '123';
          const updateData: Partial<Transaction> = { amount: 200 };

          service.updateTransaction(transactionId, updateData).subscribe(transaction => {
               expect(transaction.amount).toBe(200);
          });

          const req = httpMock.expectOne(`${environment.apiUrl}/transactions/${transactionId}`);
          expect(req.request.method).toBe('PUT');
          expect(req.request.body).toEqual(updateData);
          req.flush({ id: transactionId, amount: 200 } as Transaction);
     });

     it('should delete a transaction via DELETE', () => {
          const transactionId = '123';

          service.deleteTransaction(transactionId).subscribe(response => {
               expect(response).toBeNull();
          });

          const req = httpMock.expectOne(`${environment.apiUrl}/transactions/${transactionId}`);
          expect(req.request.method).toBe('DELETE');
          req.flush(null);
     });
});
