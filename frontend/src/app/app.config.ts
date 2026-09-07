import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';

import { routes } from './app.routes';
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
        preset: Aura
      }
    }),
    { provide: RANK_CALCULATOR_TOKEN, useClass: LexorankService }
  ]
};
