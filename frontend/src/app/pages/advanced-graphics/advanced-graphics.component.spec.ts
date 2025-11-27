import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdvancedGraphicsComponent } from './advanced-graphics.component';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TransactionService } from '../../services/transaction.service';
import { of } from 'rxjs';

describe('AdvancedGraphicsComponent', () => {
  let component: AdvancedGraphicsComponent;
  let fixture: ComponentFixture<AdvancedGraphicsComponent>;
  let transactionServiceSpy: jasmine.SpyObj<TransactionService>;

  beforeEach(async () => {
    transactionServiceSpy = jasmine.createSpyObj('TransactionService', ['getTransactions']);
    transactionServiceSpy.getTransactions.and.returnValue(of([])); // Return empty array by default

    await TestBed.configureTestingModule({
      imports: [AdvancedGraphicsComponent, NoopAnimationsModule, HttpClientTestingModule],
      providers: [
          { provide: TransactionService, useValue: transactionServiceSpy }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdvancedGraphicsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have initial widgets', () => {
    expect(component.widgets().length).toBe(2);
  });

  it('should add a widget', () => {
    const initialCount = component.widgets().length;
    component.addChart();
    expect(component.widgets().length).toBe(initialCount + 1);
  });

  it('should remove a widget', () => {
    const initialCount = component.widgets().length;
    const idToRemove = component.widgets()[0].id;
    component.removeWidget(idToRemove);
    expect(component.widgets().length).toBe(initialCount - 1);
    expect(component.widgets().find(w => w.id === idToRemove)).toBeUndefined();
  });
});
