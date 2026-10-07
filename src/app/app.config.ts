import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';

import { BILLING_ROUTES } from './billing/billing.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(BILLING_ROUTES),
  ],
};