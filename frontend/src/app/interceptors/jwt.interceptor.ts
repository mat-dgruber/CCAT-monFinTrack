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
    timeout(20000), // Aumentado para 20s para maior robustez em produção
    switchMap(() =>
      authService.authState$.pipe(
        take(1),
        switchMap((user) => {
          if (!user) {
            // Se não há usuário, prosseguimos sem token (requisições públicas)
            return next(req);
          }

          // Se há usuário, tentamos obter o token
          // forceRefresh=false por padrão, mas se houver erro recorrente de 401, 
          // poderíamos considerar forceRefresh se necessário no futuro.
          return from(user.getIdToken()).pipe(
            switchMap((token) => {
              const clonedReq = req.clone({
                setHeaders: {
                  Authorization: `Bearer ${token}`,
                },
              });
              return next(clonedReq);
            }),
            catchError((tokenErr) => {
              console.error(
                'JWT Interceptor: Erro ao obter token do Firebase para o usuário:',
                user.uid,
                tokenErr,
              );
              // Prossegue sem token: resultará em 401 controlado pelo backend
              return next(req);
            }),
          );
        }),
      ),
    ),
    catchError((err) => {
      if (err.name === 'TimeoutError') {
        console.error(
          'JWT Interceptor: Timeout (20s) aguardando inicialização do Firebase. Verifique se o domínio está autorizado no console do Firebase.',
        );
      } else {
        console.error('JWT Interceptor: Erro inesperado no fluxo de auth:', err);
      }
      return next(req);
    }),
  );
};
