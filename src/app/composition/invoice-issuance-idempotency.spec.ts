
import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { expect, it, vi } from 'vitest';

import {
  BILLING_CONTEXT,
  BillingCompositionRoot,
} from './billing-root.component';
import { provideInvoiceListSource } from '../billing/data/invoice-list-source';
import { dummyInvoiceList } from '../billing/data/invoice-list.dummy';
import { invoiceDetailReadSuccess } from '../billing/data/invoice-detail-read-state';
import { readInvoiceDetail } from '../billing/data/invoice-read-adapter';

const invoiceId = '11111111-1111-4111-8111-111111111111';
const otherInvoiceId = '33333333-3333-4333-8333-333333333333';

function invoice(id = invoiceId, version = 3) {
  return {
    id,
    patientId: '22222222-2222-4222-8222-222222222222',
    items: [],
    total: '150000.00',
    balance: '150000.00',
    currency: 'COP',
    status: 'DRAFT',
    version,
  };
}

function setup() {
  const controller = new AbortController();
  const request = vi.fn();

  const context = {
    route: {
      localPath: `/invoices/${invoiceId}`,
      basePath: '/app/billing',
    },
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

  const frame = runInInjectionContext(
    injector,
    () => new BillingCompositionRoot(),
  );

  frame.session.set({
    state: 'authenticated',
    user: { roles: ['SECRETARY_ASSISTANT'] },
  } as never);

  frame.invoiceListMode.set('http');
  frame.invoiceDetailReadState.set(
    invoiceDetailReadSuccess(readInvoiceDetail(invoice())),
  );

  return { frame, injector, request };
}

function keyAt(request: ReturnType<typeof vi.fn>, index: number): string {
  const headers = request.mock.calls[index][0].headers as Record<string, string>;
  return headers['Idempotency-Key'];
}

it('reuses the idempotency key when retrying the same draft version', async () => {
  const { frame, injector, request } = setup();

  try {
    request.mockResolvedValue({
      ok: false,
      status: 503,
      data: null,
    });

    frame.requestInvoiceIssuance({ invoiceId, expectedVersion: 3 });
    await vi.waitFor(() => expect(frame.issuingInvoice()).toBe(false));

    frame.requestInvoiceIssuance({ invoiceId, expectedVersion: 3 });
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));

    expect(keyAt(request, 0)).toBe(keyAt(request, 1));
    expect(keyAt(request, 0)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  } finally {
    injector.destroy();
  }
});

it('uses a new key when the invoice version changes', async () => {
  const { frame, injector, request } = setup();

  try {
    request.mockResolvedValue({ ok: false, status: 503, data: null });

    frame.requestInvoiceIssuance({ invoiceId, expectedVersion: 3 });
    await vi.waitFor(() => expect(frame.issuingInvoice()).toBe(false));

    frame.invoiceDetailReadState.set(
      invoiceDetailReadSuccess(readInvoiceDetail(invoice(invoiceId, 4))),
    );

    frame.requestInvoiceIssuance({ invoiceId, expectedVersion: 4 });
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));

    expect(keyAt(request, 1)).not.toBe(keyAt(request, 0));
  } finally {
    injector.destroy();
  }
});

it('uses a new key when issuing another invoice', async () => {
  const { frame, injector, request } = setup();

  try {
    request.mockResolvedValue({ ok: false, status: 503, data: null });

    frame.requestInvoiceIssuance({ invoiceId, expectedVersion: 3 });
    await vi.waitFor(() => expect(frame.issuingInvoice()).toBe(false));

    frame.route.set({
      ...frame.route(),
      localPath: `/invoices/${otherInvoiceId}`,
    });
    frame.invoiceDetailReadState.set(
      invoiceDetailReadSuccess(readInvoiceDetail(invoice(otherInvoiceId))),
    );

    frame.requestInvoiceIssuance({
      invoiceId: otherInvoiceId,
      expectedVersion: 3,
    });
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));

    expect(keyAt(request, 1)).not.toBe(keyAt(request, 0));
  } finally {
    injector.destroy();
  }
});

it('does not issue another request after a confirmed issuance', async () => {
  const { frame, injector, request } = setup();

  try {
    request.mockResolvedValue({
      ok: true,
      status: 200,
      data: { ...invoice(), status: 'ISSUED', version: 4 },
    });

    frame.requestInvoiceIssuance({ invoiceId, expectedVersion: 3 });
    await vi.waitFor(() =>
      expect(frame.invoiceDetailReadState().invoice?.status).toBe('ISSUED'),
    );

    frame.requestInvoiceIssuance({ invoiceId, expectedVersion: 3 });

    expect(request).toHaveBeenCalledTimes(1);
  } finally {
    injector.destroy();
  }
});
