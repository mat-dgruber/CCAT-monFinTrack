import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { from, switchMap, filter, take } from 'rxjs';
import { environment } from '../../environments/environment';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  // Só adiciona o token se for uma requisição para a nossa API
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }

  // Aguarda até que o estado de autenticação seja resolvido (Firebase carregado)
  return authService.isAuthResolved$.pipe(
    filter((resolved) => resolved === true),
    take(1),
    switchMap(() => authService.authState$.pipe(
      take(1),
      switchMap((user) => {
        if (user) {
          return from(user.getIdToken()).pipe(
            switchMap((token) => {
              const clonedReq = req.clone({
                setHeaders: {
                  Authorization: `Bearer ${token}`,
                },
              });
              return next(clonedReq);
            }),
          );
        }
        return next(req);
      }),
    )),
  );
};
