import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { expect, it, vi } from 'vitest';
import { BILLING_CONTEXT, BillingCompositionRoot } from './billing-root.component';
import { provideInvoiceListSource } from '../billing/data/invoice-list-source';
import { dummyInvoiceList } from '../billing/data/invoice-list.dummy';
import { invoiceDetailReadSuccess } from '../billing/data/invoice-detail-read-state';
import { readInvoiceDetail } from '../billing/data/invoice-read-adapter';

const invoiceId = '11111111-1111-4111-8111-111111111111';

const apiInvoice = {
  id: invoiceId,
  patientId: '22222222-2222-4222-8222-222222222222',
  items: [],
  total: '150000.00',
  balance: '75000.00',
  currency: 'COP',
  status: 'PARTIALLY_PAID',
  version: 3,
};

const apiPayment = {
  id: '33333333-3333-4333-8333-333333333333',
  invoiceId,
  amount: '25000.00',
  method: 'CASH',
  recordedBy: '44444444-4444-4444-8444-444444444444',
  recordedAt: '2026-10-27T12:00:00Z',
  version: 4,
};

const paymentIntent = {
  invoiceId,
  amount: '25000.00',
  method: 'CASH' as const,
  expectedVersion: 3,
  idempotencyKey: '55555555-5555-4555-8555-555555555555',
};

function setup() {
  const controller = new AbortController();
  const request = vi.fn();
  const reportFailure = vi.fn();

  const context = {
    route: {
      localPath: `/invoices/${invoiceId}/payment`,
      basePath: '/app/billing',
    },
    navigation: {
      request: vi.fn().mockResolvedValue({ status: 'applied' }),
    },
    http: { request },
    signal: controller.signal,
    reportFailure,
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

  root.invoiceListMode.set('http');
  root.invoiceDetailReadState.set(
    invoiceDetailReadSuccess(readInvoiceDetail(apiInvoice)),
  );

  root.session.set({
    state: 'authenticated',
    user: { roles: ['SECRETARY_ASSISTANT'] },
  } as never);

  return { root, injector, request, reportFailure, context };
}

it('registers a payment through the shared HTTP client using the actual invoice version', async () => {
  const { root, injector, request, context } = setup();

  try {
    const before = root.payments.read();

    request
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        data: apiPayment,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: {
          ...apiInvoice,
          balance: '50000.00',
          version: 4,
        },
      });

    await root.registerPayment(paymentIntent);

    expect(request).toHaveBeenCalledTimes(2);

    expect(request).toHaveBeenNthCalledWith(1, {
      method: 'POST',
      path: `/api/v1/invoices/${invoiceId}/payments`,
      body: {
        amount: '25000.00',
        method: 'CASH',
        expectedVersion: 3,
      },
      headers: {
        'Idempotency-Key': paymentIntent.idempotencyKey,
      },
      signal: context.signal,
    });

    expect(request).toHaveBeenNthCalledWith(2, {
      method: 'GET',
      path: `/api/v1/invoices/${invoiceId}`,
      signal: expect.any(AbortSignal),
    });

    expect(root.payments.read()).toEqual(before);
    expect(root.displayedPaymentInvoiceReadState().invoice?.balance)
      .toBe('50000.00');
  } finally {
    injector.destroy();
  }
});

it('rejects payment requests when the user lacks payment permissions', async () => {
  const { root, injector, request } = setup();

  try {
    root.session.set({
      state: 'authenticated',
      user: { roles: ['DENTIST'] },
    } as never);

    await root.registerPayment(paymentIntent);

    expect(request).not.toHaveBeenCalled();
  } finally {
    injector.destroy();
  }
});

it('rejects payments when the supplied invoice version is stale', async () => {
  const { root, injector, request } = setup();

  try {
    await root.registerPayment({
      ...paymentIntent,
      expectedVersion: 2,
    });

    expect(request).not.toHaveBeenCalled();
  } finally {
    injector.destroy();
  }
});

it('prevents duplicate submissions while a payment request is pending', async () => {
  const { root, injector, request } = setup();

  try {
    let resolvePayment!: (value: unknown) => void;

    request.mockImplementationOnce(
      () => new Promise(resolve => {
        resolvePayment = resolve;
      }),
    );

    const first = root.registerPayment(paymentIntent);
    await root.registerPayment(paymentIntent);

    expect(request).toHaveBeenCalledTimes(1);
    expect(root.recordingPayment()).toBe(true);

    resolvePayment({
      ok: true,
      status: 201,
      data: apiPayment,
    });

    await first;

    expect(
      request.mock.calls.filter(call => call[0].method === 'POST'),
    ).toHaveLength(1);

    expect(root.recordingPayment()).toBe(false);
  } finally {
    injector.destroy();
  }
});
