import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';

import { routes } from './app.routes';
import { KanbanPreset } from './core/theme/kanban.preset';
import { jwtInterceptor } from './core/interceptors/jwt.interceptor';
import { RANK_CALCULATOR_TOKEN } from './core/services/rank-calculator.interface';
import { LexorankService } from './core/services/lexorank.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([jwtInterceptor])),
    provideAnimations(),
    MessageService,
    providePrimeNG({
      theme: {
        preset: KanbanPreset,
        // The app's own styles are light-only. Left on 'system', PrimeNG switches its dialogs,
        // dropdowns and tags to dark colours whenever the OS is in dark mode.
        options: { darkModeSelector: 'none' }
      }
    }),
    { provide: RANK_CALCULATOR_TOKEN, useClass: LexorankService }
  ]
};
