import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { from, switchMap, take } from 'rxjs';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  return authService.authState$.pipe(
    take(1), // Pega o estado atual (espera se ainda não emitiu)
    switchMap(user => {
      if (user) {
        return from(user.getIdToken()).pipe(
          switchMap(token => {
            const clonedReq = req.clone({
              setHeaders: {
                Authorization: `Bearer ${token}`
              }
            });
            return next(clonedReq);
          })
        );
      }
      return next(req);
    })
  );
};