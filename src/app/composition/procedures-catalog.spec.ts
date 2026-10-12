import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { expect, it, vi } from 'vitest';
import { BILLING_CONTEXT, BillingCompositionRoot } from './billing-root.component';
import { provideInvoiceListSource } from '../billing/data/invoice-list-source';
import { PricingCatalogComponent } from '../billing/catalog/pages/pricing-catalog/pricing-catalog.component';
import { PricingCatalogService } from '../billing/catalog/services/pricing-catalog.service';

it('selects only the approved procedures route and guards an open catalog form', () => {
  const injector = Injector.create({ providers: [provideInvoiceListSource(),
    { provide: PricingCatalogService, useValue: new PricingCatalogService() },
    { provide: BILLING_CONTEXT, useValue: { route: { localPath: '/procedures' } } }] });
  try {
    const frame = runInInjectionContext(injector, () => new BillingCompositionRoot());
    const page = runInInjectionContext(injector, () => new PricingCatalogComponent());
    expect(frame.isProcedures()).toBe(true);
    expect(frame.canLeave()).toBe(true);
    vi.spyOn(frame, 'catalog').mockReturnValue(page);
    page.openForm();
    expect(frame.canLeave()).toBe(false);
    page.closeForm();
    expect(frame.canLeave()).toBe(true);
    frame.route.set({ ...frame.route(), localPath: '/procedures/unknown' });
    expect(frame.isProcedures()).toBe(false);
  } finally { injector.destroy(); }
});

it('uses shared session changes for administrator-only demo editing and cleans the subscription', () => {
  let notify!: (snapshot: any) => void;
  const stop = vi.fn();
  const snapshot = (role: string) => ({ state: 'authenticated', user: { roles: [role] } });
  const injector = Injector.create({ providers: [provideInvoiceListSource(), {
    provide: BILLING_CONTEXT, useValue: {
      route: { localPath: '/procedures' }, signal: new AbortController().signal,
      session: { getSnapshot: () => snapshot('DENTIST'), subscribe: (listener: typeof notify) => { notify = listener; return stop; } },
    },
  }] });
  const frame = runInInjectionContext(injector, () => new BillingCompositionRoot());
  expect(frame.canManagePrices()).toBe(false);
  notify(snapshot('ADMINISTRATOR'));
  expect(frame.canManagePrices()).toBe(true);
  notify({ state: 'expired', user: null });
  expect(frame.canManagePrices()).toBe(false);
  injector.destroy();
  const writes = vi.spyOn(frame.session, 'set');
  notify(snapshot('ADMINISTRATOR'));
  expect(writes).not.toHaveBeenCalled();
  expect(stop).toHaveBeenCalledTimes(1);
});
