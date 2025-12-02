import { ApplicationConfig, provideZoneChangeDetection, LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
// Mantemos o Async para performance no Angular 20
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';

registerLocaleData(localePt);

// --- NOVOS IMPORTS DO PRIMENG ---
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { ConfirmationService, MessageService } from 'primeng/api'; // <--- Importe aqui

import { routes } from './app.routes';

import { jwtInterceptor } from './interceptors/jwt.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimations(),
    provideHttpClient(
      withFetch(),
      withInterceptors([jwtInterceptor])),
    { provide: LOCALE_ID, useValue: 'pt-BR' },


    providePrimeNG({
      theme: {
        preset: Aura
      }
    })

    , ConfirmationService, MessageService // <--- Adicione aqui
  ]
};