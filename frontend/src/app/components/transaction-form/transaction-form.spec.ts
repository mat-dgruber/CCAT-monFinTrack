import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CustomConfirmService } from '../../services/custom-confirm.service';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MessageService } from 'primeng/api';

import { TransactionForm } from './transaction-form';

describe('TransactionForm', () => {
  let component: TransactionForm;
  let fixture: ComponentFixture<TransactionForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransactionForm, HttpClientTestingModule],
      providers: [CustomConfirmService, MessageService],
    }).compileComponents();

    fixture = TestBed.createComponent(TransactionForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
