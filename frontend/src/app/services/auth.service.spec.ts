import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FirebaseWrapperService } from './firebase-wrapper.service';
import { Router } from '@angular/router';
import { User, UserCredential } from 'firebase/auth';
import { environment } from '../../environments/environment';

describe('AuthService', () => {
  let service: AuthService;
  let firebaseWrapperSpy: jasmine.SpyObj<FirebaseWrapperService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    const fwSpy = jasmine.createSpyObj('FirebaseWrapperService', [
      'onAuthStateChanged',
      'createUserWithEmailAndPassword',
      'signInWithEmailAndPassword',
      'signOut',
      'updateProfile',
      'sendEmailVerification',
      'sendPasswordResetEmail',
      'deleteUser',
      'getAuth',
    ]);

    const rSpy = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: FirebaseWrapperService, useValue: fwSpy },
        { provide: Router, useValue: rSpy },
      ],
    });
    service = TestBed.inject(AuthService);
    firebaseWrapperSpy = TestBed.inject(
      FirebaseWrapperService,
    ) as jasmine.SpyObj<FirebaseWrapperService>;
    routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should handle auth state changes', fakeAsync(() => {
    // Simulate onAuthStateChanged callback
    const mockUser = { emailVerified: true, uid: '123' } as User;

    expect(firebaseWrapperSpy.onAuthStateChanged).toHaveBeenCalled();
    const callback =
      firebaseWrapperSpy.onAuthStateChanged.calls.mostRecent().args[0];

    // Trigger login
    callback(mockUser);
    
    // AuthService calls setupUser() which does a POST /api/users/setup
    const req = httpMock.expectOne(`${environment.apiUrl}/users/setup`);
    expect(req.request.method).toBe('POST');
    req.flush({});

    // Check signals and observables
    expect(service.currentUser()).toEqual(mockUser);
    tick();
  }));

  it('should logout when session expires', fakeAsync(() => {
    // Setup local storage with old timestamp
    const expiredTime = Date.now() - 1000 * 60 * 60 * 24 * 2; // 2 days ago
    spyOn(localStorage, 'getItem').and.returnValue(expiredTime.toString());
  }));

  it('should register a new user', fakeAsync(() => {
    const mockUser = { uid: 'new', emailVerified: false, email: 'test@test.com' } as User;
    const mockCredential = { user: mockUser } as UserCredential;
    firebaseWrapperSpy.createUserWithEmailAndPassword.and.resolveTo(
      mockCredential,
    );
    firebaseWrapperSpy.updateProfile.and.resolveTo();
    firebaseWrapperSpy.signOut.and.resolveTo();

    let result: any;
    service.register('test@test.com', 'pass', 'Test User').then(res => result = res);

    tick(); // Wait for createUserWithEmailAndPassword and updateProfile

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/verify-email`);
    expect(req.request.method).toBe('POST');
    req.flush({});

    tick(); // Wait for verify-email and signOut

    expect(
      firebaseWrapperSpy.createUserWithEmailAndPassword,
    ).toHaveBeenCalledWith('test@test.com', 'pass');
    expect(firebaseWrapperSpy.updateProfile).toHaveBeenCalledWith(mockUser, {
      displayName: 'Test User',
    });
    expect(firebaseWrapperSpy.signOut).toHaveBeenCalled();
    expect(result).toBe(mockCredential);
  }));

  it('should login a user', async () => {
    const mockCredential = { user: { uid: '123', emailVerified: true } } as UserCredential;
    firebaseWrapperSpy.signInWithEmailAndPassword.and.resolveTo(mockCredential);

    const result = await service.login('test@test.com', 'pass');

    expect(firebaseWrapperSpy.signInWithEmailAndPassword).toHaveBeenCalledWith(
      'test@test.com',
      'pass',
    );
    expect(result).toBe(mockCredential);
  });

  it('should throw error if email not verified on login', async () => {
    const mockCredential = { user: { uid: '123', emailVerified: false } } as UserCredential;
    firebaseWrapperSpy.signInWithEmailAndPassword.and.resolveTo(mockCredential);
    firebaseWrapperSpy.signOut.and.resolveTo();

    await expectAsync(service.login('test@test.com', 'pass')).toBeRejectedWithError(/E-mail não verificado/);
    expect(firebaseWrapperSpy.signOut).toHaveBeenCalled();
  });

  it('should logout', async () => {
    spyOn(localStorage, 'removeItem');
    firebaseWrapperSpy.signOut.and.resolveTo();

    await service.logout();

    expect(localStorage.removeItem).toHaveBeenCalledWith('loginTimestamp');
    expect(firebaseWrapperSpy.signOut).toHaveBeenCalled();
  });
});
