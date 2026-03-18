import { CustomConfirmService } from './services/custom-confirm.service';
import {
  ApplicationConfig,
  provideZoneChangeDetection,
  LOCALE_ID,
  isDevMode,
} from '@angular/core';
import {
  provideRouter,
  TitleStrategy,
  withInMemoryScrolling,
} from '@angular/router';
import { CustomTitleStrategy } from './strategies/custom-title-strategy';
// Mantemos o Async para performance no Angular 20
import { provideAnimations } from '@angular/platform-browser/animations';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';

registerLocaleData(localePt);

// --- NOVOS IMPORTS DO PRIMENG ---
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { MessageService } from 'primeng/api'; // <--- Importe aqui
import { provideMarkdown } from 'ngx-markdown';
import { GlobalErrorHandler } from './services/error-handler.service';
import { ErrorHandler } from '@angular/core';

import { routes } from './app.routes';

import { jwtInterceptor } from './interceptors/jwt.interceptor';
import { provideServiceWorker } from '@angular/service-worker';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'enabled',
      }),
    ),
    { provide: TitleStrategy, useClass: CustomTitleStrategy },
    provideAnimations(),
    provideHttpClient(withFetch(), withInterceptors([jwtInterceptor])),
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    { provide: ErrorHandler, useClass: GlobalErrorHandler },

    providePrimeNG({
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: '.dark',
        },
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
        dateAfter: 'Data é depois',
        dayNames: [
          'Domingo',
          'Segunda',
          'Terça',
          'Quarta',
          'Quinta',
          'Sexta',
          'Sábado',
        ],
        dayNamesShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
        dayNamesMin: ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'],
        monthNames: [
          'Janeiro',
          'Fevereiro',
          'Março',
          'Abril',
          'Maio',
          'Junho',
          'Julho',
          'Agosto',
          'Setembro',
          'Outubro',
          'Novembro',
          'Dezembro',
        ],
        monthNamesShort: [
          'Jan',
          'Fev',
          'Mar',
          'Abr',
          'Mai',
          'Jun',
          'Jul',
          'Ago',
          'Set',
          'Out',
          'Nov',
          'Dez',
        ],
        today: 'Hoje',
        weekHeader: 'Sem',
        firstDayOfWeek: 0,
        dateFormat: 'dd/mm/yy',
        weak: 'Fraca',
        medium: 'Média',
        strong: 'Forte',
        passwordPrompt: 'Digite uma senha',
        emptyFilterMessage: 'Nenhum resultado encontrado',
        emptyMessage: 'Nenhuma opção disponível',
      },
    }),

    CustomConfirmService,
    MessageService,
    provideMarkdown(), // Enable Markdown
    provideServiceWorker('ngsw-worker.js', {
      enabled:
        !isDevMode() || localStorage.getItem('ENABLE_SW') === 'true',
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
