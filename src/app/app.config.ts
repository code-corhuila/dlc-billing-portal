import { ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { BILLING_ROUTES } from './billing/billing.routes';
import { provideInvoiceListSource } from './billing/data/invoice-list-source';

export const appConfig: ApplicationConfig = {
  providers: [
    provideInvoiceListSource(),
    provideRouter(BILLING_ROUTES, withComponentInputBinding()),
  ],
};
