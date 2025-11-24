import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CategoryManager } from './category-manager';

describe('CategoryManager', () => {
  let component: CategoryManager;
  let fixture: ComponentFixture<CategoryManager>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoryManager]
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
