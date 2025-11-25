import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { from, switchMap } from 'rxjs';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const user = authService.currentUser();

  // Se tiver usuário logado, tentamos pegar o Token
  if (user) {
    // O Firebase retorna uma Promise (getIdToken), precisamos converter para Observable (from)
    // para o Angular entender.
    return from(user.getIdToken()).pipe(
      switchMap(token => {
        // Clonamos a requisição original e adicionamos o Cabeçalho
        const clonedReq = req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        });
        // Manda a requisição clonada com o token
        return next(clonedReq);
      })
    );
  }

  // Se não tiver usuário, manda a requisição normal
  return next(req);
};