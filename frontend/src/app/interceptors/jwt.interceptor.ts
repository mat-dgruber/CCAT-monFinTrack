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
    switchMap(() =>
      authService.authState$.pipe(
        take(1),
        switchMap((user) => {
          if (!user) {
            // Se não há usuário, prosseguimos sem token (requisições públicas)
            return next(req);
          }

          // Se há usuário, tentamos obter o token
          return from(user.getIdToken()).pipe(
            switchMap((token) => {
              const clonedReq = req.clone({
                setHeaders: {
                  Authorization: `Bearer ${token}`,
                },
              });
              // Executa a requisição autenticada
              return next(clonedReq);
            }),
            catchError((tokenErr) => {
              // ERRO AO OBTER TOKEN (Firebase error)
              console.error(
                'JWT Interceptor: Erro ao obter token do Firebase:',
                tokenErr,
              );
              // Nesse caso específico de erro no token, podemos tentar prosseguir sem ele
              // ou rethrow. Como o app depende do token para rotas privadas,
              // prosseguir sem ele causará 401 no backend, o que é o comportamento correto.
              return next(req);
            }),
          );
        }),
      ),
    ),
    catchError((err) => {
      // Este catchError captura:
      // 1. Timeout na resolução do Auth (10s)
      // 2. Erros na cadeia de streams antes do next(clonedReq)

      // IMPORTANTE: Se o erro for um HttpErrorResponse vindo do next(clonedReq),
      // ele NÃO deve ser capturado aqui se quisermos que o componente trate o erro.
      // No RxJS, se o erro acontece dentro de um switchMap/next(), este catchError externo PODE capturar.

      if (err.name === 'TimeoutError') {
        console.error(
          'JWT Interceptor: Auth resolution timed out (10s). Proceeding without token.',
        );
      } else {
        console.error('JWT Interceptor: Unexpected error in auth chain:', err);
      }

      return next(req);
    }),
  );
};
