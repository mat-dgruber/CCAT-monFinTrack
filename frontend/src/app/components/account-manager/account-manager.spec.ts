import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CustomConfirmService } from '../../services/custom-confirm.service';
import { AccountManager } from './account-manager';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MessageService } from 'primeng/api';

describe('AccountManager', () => {
 let component: AccountManager;
 let fixture: ComponentFixture<AccountManager>;

 beforeEach(async () => {
 await TestBed.configureTestingModule({
 imports: [AccountManager, HttpClientTestingModule, NoopAnimationsModule],
 providers: [CustomConfirmService, MessageService]
 })
 .compileComponents();

 fixture = TestBed.createComponent(AccountManager);
 component = fixture.componentInstance;
 fixture.detectChanges();
 });

 it('should create', () => {
 expect(component).toBeTruthy();
 });
});
