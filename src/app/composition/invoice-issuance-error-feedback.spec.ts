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
const idempotencyKey = '99999999-9999-4999-8999-999999999999';

const draftInvoice = {
  id: invoiceId,
  patientId: '22222222-2222-4222-8222-222222222222',
  items: [],
  total: '150000.00',
  balance: '150000.00',
  currency: 'COP',
  status: 'DRAFT',
  version: 3,
};

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
    invoiceDetailReadSuccess(readInvoiceDetail(draftInvoice)),
  );

  return { frame, injector, request, context };
}

function issuanceRequest() {
  return {
    invoiceId,
    expectedVersion: 3,
    idempotencyKey,
  };
}

it('shows an error message when invoice issuance fails', async () => {
  const { frame, injector, request } = setup();

  try {
    request.mockResolvedValue({
      ok: false,
      status: 503,
      data: null,
    });

    await frame.issueInvoice(issuanceRequest());

    expect(frame.issuanceMessage()).toMatch(/no se pudo emitir/i);
    expect(frame.invoiceDetailReadState().invoice?.status).toBe('DRAFT');
    expect(frame.issuingInvoice()).toBe(false);
  } finally {
    injector.destroy();
  }
});

it('shows conflict feedback without changing the draft invoice', async () => {
  const { frame, injector, request } = setup();

  try {
    request.mockResolvedValue({
      ok: false,
      status: 409,
      data: null,
    });

    await frame.issueInvoice(issuanceRequest());

    expect(frame.issuanceMessage()).toMatch(/no se pudo emitir/i);
    expect(frame.invoiceDetailReadState().invoice?.status).toBe('DRAFT');
    expect(frame.invoiceDetailReadState().invoice?.version).toBe(3);
  } finally {
    injector.destroy();
  }
});

it('clears previous error feedback before a new issuance attempt', async () => {
  const { frame, injector, request } = setup();

  try {
    request.mockResolvedValueOnce({
      ok: false,
      status: 503,
      data: null,
    });

    request.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: {
        ...draftInvoice,
        status: 'ISSUED',
        version: 4,
      },
    });

    await frame.issueInvoice(issuanceRequest());

    expect(frame.issuanceMessage()).toMatch(/no se pudo emitir/i);

    await frame.issueInvoice(issuanceRequest());

    expect(frame.issuanceMessage()).toBe('');
    expect(frame.invoiceDetailReadState().invoice?.status).toBe('ISSUED');
    expect(request).toHaveBeenCalledTimes(2);
  } finally {
    injector.destroy();
  }
});

it('does not report success when the issuance response is invalid', async () => {
  const { frame, injector, request } = setup();

  try {
    request.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        ...draftInvoice,
        status: 'DRAFT',
      },
    });

    await frame.issueInvoice(issuanceRequest());

    expect(frame.issuanceMessage()).toMatch(/no se pudo emitir/i);
    expect(frame.invoiceDetailReadState().invoice?.status).toBe('DRAFT');
  } finally {
    injector.destroy();
  }
});
