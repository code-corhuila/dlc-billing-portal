import { describe, expect, it } from 'vitest';

import { BILLING_ROUTES } from './billing.routes';

describe('billing routes', () => {
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
});