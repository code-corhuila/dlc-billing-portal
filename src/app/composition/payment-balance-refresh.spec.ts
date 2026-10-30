import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { expect, it, vi } from 'vitest';
import { BILLING_CONTEXT, BillingCompositionRoot } from './billing-root.component';
import { provideInvoiceListSource } from '../billing/data/invoice-list-source';
import { dummyInvoiceList } from '../billing/data/invoice-list.dummy';
import { invoiceDetailReadSuccess } from '../billing/data/invoice-detail-read-state';
import { readInvoiceDetail } from '../billing/data/invoice-read-adapter';

const invoiceId = '11111111-1111-4111-8111-111111111111';
const paymentId = '33333333-3333-4333-8333-333333333333';

const invoice = {
  id: invoiceId,
  patientId: '22222222-2222-4222-8222-222222222222',
  items: [],
  total: '150000.00',
  balance: '75000.00',
  currency: 'COP',
  status: 'PARTIALLY_PAID',
  version: 3,
};

const payment = {
  id: paymentId,
  invoiceId,
  amount: '25000.00',
  method: 'CASH',
  recordedBy: '44444444-4444-4444-8444-444444444444',
  recordedAt: '2026-10-27T12:00:00Z',
  version: 4,
};

function setup() {
  const controller = new AbortController();
  const request = vi.fn();
  const context = {
    route: {
      localPath: `/invoices/${invoiceId}/payment`,
      basePath: '/app/billing',
    },
    navigation: { request: vi.fn() },
    http: { request },
    signal: controller.signal,
    reportFailure: vi.fn(),
    session: { getSnapshot: vi.fn(), subscribe: () => () => {} },
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
    invoiceDetailReadSuccess(readInvoiceDetail(invoice)),
  );
  root.session.set({
    state: 'authenticated',
    user: { roles: ['SECRETARY_ASSISTANT'] },
  } as never);

  return { root, injector, request, controller };
}

const intent = {
  invoiceId,
  amount: '25000.00',
  method: 'CASH' as const,
  expectedVersion: 3,
  idempotencyKey: '55555555-5555-4555-8555-555555555555',
};

const success = (balance: string, status: string) => ({
  ok: true,
  status: 200,
  data: { ...invoice, balance, status, version: 4 },
});

it('refreshes invoice balance after a successful partial payment', async () => {
  const { root, injector, request } = setup();

  try {
    request
      .mockResolvedValueOnce({ ok: true, status: 201, data: payment })
      .mockResolvedValueOnce(success('50000.00', 'PARTIALLY_PAID'));

    await root.registerPayment(intent);

    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1][0]).toEqual({
      method: 'GET',
      path: `/api/v1/invoices/${invoiceId}`,
      signal: expect.any(AbortSignal),
    });
    expect(root.displayedPaymentInvoiceReadState().invoice?.balance).toBe('50000.00');
    expect(root.paymentRegistrationMessage()).toContain('Pago registrado');
  } finally {
    injector.destroy();
  }
});

it('shows a paid invoice with zero balance after full payment', async () => {
  const { root, injector, request } = setup();

  try {
    request
      .mockResolvedValueOnce({ ok: true, status: 201, data: payment })
      .mockResolvedValueOnce(success('0.00', 'PAID'));

    await root.registerPayment(intent);

    expect(root.displayedPaymentInvoiceReadState().invoice?.status).toBe('PAID');
    expect(root.displayedPaymentInvoiceReadState().invoice?.balance).toBe('0.00');
  } finally {
    injector.destroy();
  }
});

it('does not repeat a recorded payment when invoice refresh fails', async () => {
  const { root, injector, request } = setup();

  try {
    request
      .mockResolvedValueOnce({ ok: true, status: 201, data: payment })
      .mockResolvedValueOnce({ ok: false, status: 503, kind: 'http' });

    await root.registerPayment(intent);

    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls.filter(call => call[0].method === 'POST')).toHaveLength(1);
    expect(root.paymentRegistrationMessage()).toContain('Pago registrado');
    expect(root.paymentRegistrationMessage()).toContain('actualizar');
  } finally {
    injector.destroy();
  }
});

it('does not display another invoice after changing routes during refresh', async () => {
  const { root, injector, request } = setup();

  try {
    let resolveRefresh!: (value: unknown) => void;

    request
      .mockResolvedValueOnce({ ok: true, status: 201, data: payment })
      .mockImplementationOnce(() => new Promise(resolve => {
        resolveRefresh = resolve;
      }));

    const pending = root.registerPayment(intent);
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));

    root.route.set({
      ...root.route(),
      localPath: '/invoices/other-invoice/payment',
    });

    resolveRefresh(success('50000.00', 'PARTIALLY_PAID'));
    await pending;

    expect(root.displayedPaymentInvoiceReadState().invoice?.id)
      .not.toBe(invoiceId);
    expect(root.paymentRegistrationMessage()).toBe('');
  } finally {
    injector.destroy();
  }
});

it('does not publish refreshed data after destroying the component', async () => {
  const { root, injector, request } = setup();

  let resolveRefresh!: (value: unknown) => void;

  request
    .mockResolvedValueOnce({ ok: true, status: 201, data: payment })
    .mockImplementationOnce(() => new Promise(resolve => {
      resolveRefresh = resolve;
    }));

  const pending = root.registerPayment(intent);
  await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));

  const writes = vi.spyOn(root.invoiceDetailReadState, 'set');
  injector.destroy();
  writes.mockClear();

  resolveRefresh(success('50000.00', 'PARTIALLY_PAID'));
  await pending;

  expect(writes).not.toHaveBeenCalled();
});
