import { ApplicationConfig, provideZoneChangeDetection, LOCALE_ID, isDevMode } from '@angular/core';
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
import { provideServiceWorker } from '@angular/service-worker';

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
        preset: Aura,
        options: {
          darkModeSelector: '.dark'
        }
      },
      translation: {
        accept: 'Sim',
        reject: 'Não',
        apply: 'Aplicar',
        clear: 'Limpar',
        addRule: 'Adicionar Regra',
        matchAll: 'Corresponder a Todos',
        matchAny: 'Corresponder a Qualquer',
        startsWith: 'Começa com',
        contains: 'Contém',
        notContains: 'Não contém',
        endsWith: 'Termina com',
        equals: 'Igual a',
        notEquals: 'Diferente de',
        noFilter: 'Sem filtro',
        lt: 'Menor que',
        lte: 'Menor ou igual a',
        gt: 'Maior que',
        gte: 'Maior ou igual a',
        is: 'É',
        isNot: 'Não é',
        before: 'Antes',
        after: 'Depois',
        dateIs: 'Data é',
        dateIsNot: 'Data não é',
        dateBefore: 'Data é antes',
        dateAfter: 'Data é depois'
      }
    }),

    ConfirmationService,
    MessageService,
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
};
