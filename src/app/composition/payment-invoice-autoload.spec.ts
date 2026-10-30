import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { expect, it, vi } from 'vitest';
import {
  BILLING_CONTEXT,
  BillingCompositionRoot,
} from './billing-root.component';
import { provideInvoiceListSource } from '../billing/data/invoice-list-source';
import { dummyInvoiceList } from '../billing/data/invoice-list.dummy';

const invoiceId = '11111111-1111-4111-8111-111111111111';
const otherId = '33333333-3333-4333-8333-333333333333';

function invoiceResponse(id: string) {
  return {
    ok: true,
    status: 200,
    data: {
      id,
      patientId: '22222222-2222-4222-8222-222222222222',
      items: [],
      total: '150000.00',
      balance: '75000.00',
      currency: 'COP',
      status: 'PARTIALLY_PAID',
      version: 3,
    },
  };
}

function setup(localPath = `/invoices/${invoiceId}/payment`) {
  const controller = new AbortController();
  const request = vi.fn();

  const context = {
    route: { localPath, basePath: '/app/billing' },
    navigation: {
      request: vi.fn().mockResolvedValue({ status: 'applied' }),
    },
    http: { request },
    signal: controller.signal,
    reportFailure: vi.fn(),
    session: {
      getSnapshot: vi.fn(),
      subscribe: () => () => {},
    },
  };

  const injector = Injector.create({
    providers: [
      provideInvoiceListSource(dummyInvoiceList),
      { provide: BILLING_CONTEXT, useValue: context },
    ],
  });

  const root = runInInjectionContext(
    injector,
    () => new BillingCompositionRoot(),
  );

  return { root, injector, request, controller };
}

it('uses the real invoice mode when the portal starts', () => {
  const { root, injector } = setup();

  try {
    expect(root.invoiceListMode()).toBe('http');
    expect(root.useHttpPaymentForm()).toBe(true);
  } finally {
    injector.destroy();
  }
});

it('loads the invoice automatically when entering a payment route', async () => {
  const { root, injector, request } = setup();

  try {
    request.mockResolvedValue(invoiceResponse(invoiceId));

    await root.syncInvoiceRoute();

    expect(request).toHaveBeenCalledExactlyOnceWith({
      method: 'GET',
      path: `/api/v1/invoices/${invoiceId}`,
      signal: expect.any(AbortSignal),
    });

    expect(root.displayedPaymentInvoiceReadState().invoice?.id).toBe(invoiceId);
    expect(root.displayedPaymentInvoiceReadState().invoice?.version).toBe(3);
  } finally {
    injector.destroy();
  }
});

it('does not reload the same invoice unnecessarily', async () => {
  const { root, injector, request } = setup();

  try {
    request.mockResolvedValue(invoiceResponse(invoiceId));

    await root.syncInvoiceRoute();
    await root.syncInvoiceRoute();

    expect(request).toHaveBeenCalledTimes(1);
  } finally {
    injector.destroy();
  }
});

it('loads a new invoice and ignores outdated responses after changing routes', async () => {
  const { root, injector, request } = setup();

  try {
    const resolvers: Array<(value: unknown) => void> = [];

    request.mockImplementation(() => new Promise(resolve => {
      resolvers.push(resolve);
    }));

    const first = root.syncInvoiceRoute();

    root.route.set({
      ...root.route(),
      localPath: `/invoices/${otherId}/payment`,
    });

    const second = root.syncInvoiceRoute();

    expect(request).toHaveBeenCalledTimes(2);

    resolvers[1](invoiceResponse(otherId));
    await second;

    resolvers[0](invoiceResponse(invoiceId));
    await first;

    expect(root.displayedPaymentInvoiceReadState().invoice?.id).toBe(otherId);
  } finally {
    injector.destroy();
  }
});

it('does not publish late responses after destroying the composition root', async () => {
  const { root, injector, request } = setup();

  let resolveRequest!: (value: unknown) => void;

  request.mockReturnValue(new Promise(resolve => {
    resolveRequest = resolve;
  }));

  const pending = root.syncInvoiceRoute();
  const writes = vi.spyOn(root.invoiceDetailReadState, 'set');

  injector.destroy();
  writes.mockClear();

  resolveRequest(invoiceResponse(invoiceId));
  await pending;

  expect(writes).not.toHaveBeenCalled();
});
