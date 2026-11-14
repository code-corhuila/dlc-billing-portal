import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { expect, it, vi } from 'vitest';
import { BILLING_CONTEXT, BillingCompositionRoot } from './billing-root.component';
import { provideInvoiceListSource } from '../billing/data/invoice-list-source';
import { PricingCatalogComponent } from '../billing/catalog/pages/pricing-catalog/pricing-catalog.component';
import { PricingCatalogService } from '../billing/catalog/services/pricing-catalog.service';

const price = {
  id: '11111111-1111-4111-8111-111111111111',
  procedureCode: 'PROC-001',
  name: 'Limpieza dental',
  basePrice: '150000.00' as const,
  currency: 'COP' as const,
  status: 'ACTIVE' as const,
  version: 1,
};

const createRequest = {
  procedureCode: 'PROC-001',
  name: 'Limpieza dental',
  basePrice: '150000.00' as const,
  validFrom: '2026-11-01T00:00:00Z',
};

function setupCreation(role = 'ADMINISTRATOR') {
  const request = vi.fn().mockResolvedValue({
    ok: true,
    status: 201,
    data: price,
  });

  const injector = Injector.create({
    providers: [
      provideInvoiceListSource(),
      {
        provide: BILLING_CONTEXT,
        useValue: {
          route: { localPath: '/procedures' },
          signal: new AbortController().signal,
          http: { request },
          session: {
            getSnapshot: () => ({
              state: 'authenticated',
              user: { roles: [role] },
            }),
            subscribe: () => () => {},
          },
        },
      },
    ],
  });

  const frame = runInInjectionContext(
    injector,
    () => new BillingCompositionRoot(),
  );

  return { frame, injector, request };
}

it('selects only the approved procedures route and guards an open catalog form', () => {
  const injector = Injector.create({ providers: [provideInvoiceListSource(),
    { provide: PricingCatalogService, useValue: new PricingCatalogService() },
    { provide: BILLING_CONTEXT, useValue: { route: { localPath: '/procedures' },
      session: { getSnapshot: vi.fn(), subscribe: () => () => {} } } }] });
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

it('prevents non-administrators from creating price versions', async () => {
  const { frame, injector, request } = setupCreation('DENTIST');

  try {
    await frame.createPriceVersion(createRequest, 'price-key-001');

    expect(request).not.toHaveBeenCalled();
    expect(frame.creatingPriceVersion()).toBe(false);
  } finally {
    injector.destroy();
  }
});

it('prevents duplicate price creation while a request is pending', async () => {
  const { frame, injector, request } = setupCreation();

  let resolveRequest!: (response: unknown) => void;
  request.mockReturnValue(new Promise(resolve => {
    resolveRequest = resolve;
  }));

  try {
    const first = frame.createPriceVersion(createRequest, 'price-key-002');
    const second = frame.createPriceVersion(createRequest, 'price-key-003');

    expect(frame.creatingPriceVersion()).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);

    resolveRequest({ ok: true, status: 201, data: price });

    await Promise.all([first, second]);

    expect(frame.creatingPriceVersion()).toBe(false);
  } finally {
    injector.destroy();
  }
});

it('refreshes the catalog after successfully creating a price version', async () => {
  const { frame, injector, request } = setupCreation();

  request
    .mockResolvedValueOnce({ ok: true, status: 201, data: price })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: {
        data: [price],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    });

  try {
    await frame.createPriceVersion(createRequest, 'price-key-004');

    expect(request).toHaveBeenCalledTimes(2);
    expect(frame.procedurePricesReadState()).toEqual({
      status: 'success',
      prices: [price],
    });
    expect(frame.creatingPriceVersion()).toBe(false);
  } finally {
    injector.destroy();
  }
});
