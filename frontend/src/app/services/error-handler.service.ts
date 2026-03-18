import { ErrorHandler, Injectable, Injector } from '@angular/core';
import { FirebaseWrapperService } from './firebase-wrapper.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(private injector: Injector) {}

  handleError(error: any): void {
    const firebaseService = this.injector.get(FirebaseWrapperService);
    
    const message = error.message ? error.message : error.toString();
    const stack = error.stack ? error.stack : '';

    console.error('Global Error Caught:', error);

    // Log error to Analytics
    firebaseService.logEvent('exception', {
      description: message,
      fatal: false,
      stack_trace: stack.substring(0, 100) // Keep it short
    });

    // We can also re-throw or handle UI notifications here if needed
    // throw error; 
  }
}
