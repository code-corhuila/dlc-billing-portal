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

  return { frame, injector, request };
}

function issuanceRequest() {
  return {
    invoiceId,
    expectedVersion: 3,
    idempotencyKey,
  };
}

it('explains version conflicts when issuance returns HTTP 409', async () => {
  const { frame, injector, request } = setup();

  try {
    request.mockResolvedValue({
      ok: false,
      status: 409,
      data: null,
    });

    await frame.issueInvoice(issuanceRequest());

    expect(frame.issuanceMessage()).toMatch(/conflicto|versión|actualiz/i);
    expect(frame.invoiceDetailReadState().invoice?.status).toBe('DRAFT');
    expect(frame.invoiceDetailReadState().invoice?.version).toBe(3);
  } finally {
    injector.destroy();
  }
});

it('explains insufficient permissions when issuance returns HTTP 403', async () => {
  const { frame, injector, request } = setup();

  try {
    request.mockResolvedValue({
      ok: false,
      status: 403,
      data: null,
    });

    await frame.issueInvoice(issuanceRequest());

    expect(frame.issuanceMessage()).toMatch(/permisos|autorización/i);
    expect(frame.invoiceDetailReadState().invoice?.status).toBe('DRAFT');
  } finally {
    injector.destroy();
  }
});

it('explains temporary service unavailability for HTTP 503', async () => {
  const { frame, injector, request } = setup();

  try {
    request.mockResolvedValue({
      ok: false,
      status: 503,
      data: null,
    });

    await frame.issueInvoice(issuanceRequest());

    expect(frame.issuanceMessage()).toMatch(/servicio|temporalmente/i);
    expect(frame.invoiceDetailReadState().invoice?.status).toBe('DRAFT');
  } finally {
    injector.destroy();
  }
});

it('keeps generic feedback for unexpected HTTP 500 failures', async () => {
  const { frame, injector, request } = setup();

  try {
    request.mockResolvedValue({
      ok: false,
      status: 500,
      data: null,
    });

    await frame.issueInvoice(issuanceRequest());

    expect(frame.issuanceMessage()).toMatch(/no se pudo emitir/i);
    expect(frame.invoiceDetailReadState().invoice?.status).toBe('DRAFT');
  } finally {
    injector.destroy();
  }
});

it('clears error feedback after a successful retry', async () => {
  const { frame, injector, request } = setup();

  try {
    request
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        data: null,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: {
          ...draftInvoice,
          status: 'ISSUED',
          version: 4,
        },
      });

    await frame.issueInvoice(issuanceRequest());

    expect(frame.issuanceMessage()).not.toBe('');

    await frame.issueInvoice(issuanceRequest());

    expect(frame.issuanceMessage()).toBe('');
    expect(frame.invoiceDetailReadState().invoice?.status).toBe('ISSUED');
    expect(request).toHaveBeenCalledTimes(2);
  } finally {
    injector.destroy();
  }
});
