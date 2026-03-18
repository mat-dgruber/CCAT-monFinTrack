import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { from, switchMap, filter, take, timeout, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  // Só adiciona o token se for uma requisição para a nossa API
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }

  // Aguarda até que o estado de autenticação seja resolvido (Firebase carregado)
  // Adicionamos um timeout de 20s para evitar que o app trave se o Firebase falhar em redes lentas
  return authService.isAuthResolved$.pipe(
    filter((resolved) => resolved === true),
    take(1),
    timeout({ first: 20000, with: () => of(true) }), // Não lança erro, apenas emite e continua
    switchMap(() =>
      authService.authState$.pipe(
        take(1),
        switchMap((user) => {
          if (!user) return next(req);

          return from(user.getIdToken()).pipe(
            catchError((tokenErr) => {
              console.error('JWT Interceptor: Erro ao obter token do Firebase:', tokenErr);
              return of(null);
            }),
            switchMap((token) => {
              if (!token) return next(req);

              const clonedReq = req.clone({
                setHeaders: { Authorization: `Bearer ${token}` },
              });
              return next(clonedReq);
            })
          );
        }),
        catchError((err) => {
          console.error('JWT Interceptor: Erro no authState$:', err);
          return next(req);
        })
      )
    ),
    catchError((err) => {
      console.error('JWT Interceptor: Erro no fluxo de auth:', err);
      return next(req);
    })
  );
};
