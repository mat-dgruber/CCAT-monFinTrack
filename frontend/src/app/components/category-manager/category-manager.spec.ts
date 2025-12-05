import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CategoryManager } from './category-manager';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ConfirmationService, MessageService } from 'primeng/api';

describe('CategoryManager', () => {
  let component: CategoryManager;
  let fixture: ComponentFixture<CategoryManager>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoryManager, HttpClientTestingModule, NoopAnimationsModule],
      providers: [ConfirmationService, MessageService]
    })
      .compileComponents();

    fixture = TestBed.createComponent(CategoryManager);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
