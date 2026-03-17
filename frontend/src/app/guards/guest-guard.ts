import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, take } from 'rxjs/operators';

export const guestGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.authState$.pipe(
    take(1),
    map((user) => {
      if (user) {
        // Authenticated users go to app dashboard
        return router.createUrlTree(['/app']);
      } else {
        return true;
      }
    }),
  );
};
