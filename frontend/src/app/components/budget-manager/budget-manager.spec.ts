import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CustomConfirmService } from '../../services/custom-confirm.service';
import { BudgetManager } from './budget-manager';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MessageService } from 'primeng/api';
import { provideMarkdown } from 'ngx-markdown';

describe('BudgetManager', () => {
  let component: BudgetManager;
  let fixture: ComponentFixture<BudgetManager>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BudgetManager, HttpClientTestingModule, NoopAnimationsModule],
      providers: [CustomConfirmService, MessageService, provideMarkdown()],
    }).compileComponents();

    fixture = TestBed.createComponent(BudgetManager);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
