import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TransactionManager } from './transaction-manager';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TransactionService } from '../../services/transaction.service';
import { CategoryService } from '../../services/category.service';
import { AccountService } from '../../services/account.service';
import { ConfirmationService, MessageService } from 'primeng/api';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('TransactionManager', () => {
  let component: TransactionManager;
  let fixture: ComponentFixture<TransactionManager>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransactionManager, HttpClientTestingModule, NoopAnimationsModule],
      providers: [
          TransactionService,
          CategoryService,
          AccountService,
          ConfirmationService,
          MessageService
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TransactionManager);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
