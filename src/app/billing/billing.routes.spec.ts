import { describe, expect, it } from 'vitest';

import { BILLING_ROUTES } from './billing.routes';

describe('billing routes', () => {
  it('exposes the billing list as the feature root route', () => {
    const rootRoute = BILLING_ROUTES.find(
      (route) => route.path === '',
    );

    expect(rootRoute).toBeDefined();
    expect(rootRoute?.redirectTo).toBeUndefined();
    expect(rootRoute?.loadComponent).toBeDefined();
  });

  it('exposes the invoice review route as a feature-relative route', () => {
    const invoiceRoute = BILLING_ROUTES.find(
      (route) => route.path === 'invoices/:id',
    );

    expect(invoiceRoute).toBeDefined();
  });

  it('does not prefix the invoice review route with billing', () => {
    const prefixedRoute = BILLING_ROUTES.find(
      (route) => route.path === 'billing/invoices/:id',
    );

    expect(prefixedRoute).toBeUndefined();
  });

  it('exposes the payment registration route as a feature-relative route', () => {
    const paymentRoute = BILLING_ROUTES.find(
      (route) => route.path === 'invoices/:id/payments/new',
    );

    expect(paymentRoute).toBeDefined();
  });

  it('does not prefix the payment registration route with billing', () => {
    const prefixedRoute = BILLING_ROUTES.find(
      (route) => route.path === 'billing/invoices/:id/payments/new',
    );

    expect(prefixedRoute).toBeUndefined();
  });
});