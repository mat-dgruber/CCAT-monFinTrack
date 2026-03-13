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
  // Adicionamos um timeout de 10s para evitar que o app trave (504) se o Firebase falhar
  return authService.isAuthResolved$.pipe(
    filter((resolved) => resolved === true),
    take(1),
    timeout(10000), // 10 segundos de segurança
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
            catchError((err) => {
              console.error('Erro ao obter token do Firebase:', err);
              return next(req);
            })
          );
        }
        return next(req);
      }),
    )),
    catchError((err) => {
      // Se der timeout ou erro na resolução do Auth, prosseguimos sem token para não travar o app
      console.error('JWT Interceptor: Auth resolution timed out or failed. Proceeding without token.', err);
      return next(req);
    })
  );
};
