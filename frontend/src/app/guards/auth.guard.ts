import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, take } from 'rxjs/operators';

export const authGuard: CanActivateFn = (route, state) => {
     const authService = inject(AuthService);
     const router = inject(Router);

     // Use authState$ to wait for the initial auth check to complete
     return authService.authState$.pipe(
          take(1), // Take 1 to complete the observable
          map(user => {
               if (user) {
                    return true;
               } else {
                    // Redirect to login page with return url
                    return router.createUrlTree(['/login']);
               }
          })
     );
};
