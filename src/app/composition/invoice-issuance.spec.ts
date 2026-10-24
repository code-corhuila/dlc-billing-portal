
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

  frame.invoiceListMode.set('http');
  frame.invoiceDetailReadState.set(
    invoiceDetailReadSuccess(readInvoiceDetail(draftInvoice)),
  );

  return { frame, injector, request, controller, context };
}

it('does not allow issuance without an authorized staff session', () => {
  const { frame, injector } = setup();

  try {
    expect(frame.canIssueInvoices()).toBe(false);
  } finally {
    injector.destroy();
  }
});

it('allows invoice issuance for authorized staff in HTTP detail mode', () => {
  const { frame, injector } = setup();

  try {
    frame.session.set({
      state: 'authenticated',
      user: { roles: ['SECRETARY_ASSISTANT'] },
    } as never);

    expect(frame.canIssueInvoices()).toBe(true);
  } finally {
    injector.destroy();
  }
});

it('does not allow issuance in demo mode', () => {
  const { frame, injector } = setup();

  try {
    frame.session.set({
      state: 'authenticated',
      user: { roles: ['ADMINISTRATOR'] },
    } as never);

    frame.invoiceListMode.set('demo');

    expect(frame.canIssueInvoices()).toBe(false);
  } finally {
    injector.destroy();
  }
});

it('issues the validated route invoice using its current version', async () => {
  const { frame, injector, request, context } = setup();

  try {
    frame.session.set({
      state: 'authenticated',
      user: { roles: ['SECRETARY_ASSISTANT'] },
    } as never);

    request.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        ...draftInvoice,
        status: 'ISSUED',
        version: 4,
      },
      headers: {},
      correlationId: 'test-correlation',
    });

    await frame.issueInvoice({
      invoiceId,
      expectedVersion: 3,
      idempotencyKey,
    });

    expect(request).toHaveBeenCalledExactlyOnceWith({
      method: 'POST',
      path: `/api/v1/invoices/${invoiceId}/issuances`,
      body: { expectedVersion: 3 },
      headers: { 'Idempotency-Key': idempotencyKey },
      signal: context.signal,
    });

    expect(frame.invoiceDetailReadState().invoice?.status).toBe('ISSUED');
    expect(frame.invoiceDetailReadState().invoice?.version).toBe(4);
  } finally {
    injector.destroy();
  }
});

it('does not send issuance requests for unrelated invoice routes', async () => {
  const { frame, injector, request } = setup();

  try {
    frame.session.set({
      state: 'authenticated',
      user: { roles: ['ADMINISTRATOR'] },
    } as never);

    await frame.issueInvoice({
      invoiceId: '33333333-3333-4333-8333-333333333333',
      expectedVersion: 3,
      idempotencyKey,
    });

    expect(request).not.toHaveBeenCalled();
  } finally {
    injector.destroy();
  }
});

it('prevents duplicate issuance requests while one is pending', async () => {
  const { frame, injector, request } = setup();

  try {
    frame.session.set({
      state: 'authenticated',
      user: { roles: ['ADMINISTRATOR'] },
    } as never);

    let settle!: (value: unknown) => void;

    request.mockReturnValue(new Promise(resolve => {
      settle = resolve;
    }));

    const first = frame.issueInvoice({
      invoiceId,
      expectedVersion: 3,
      idempotencyKey,
    });

    expect(frame.issuingInvoice()).toBe(true);

    await frame.issueInvoice({
      invoiceId,
      expectedVersion: 3,
      idempotencyKey,
    });

    expect(request).toHaveBeenCalledTimes(1);

    settle({
      ok: true,
      status: 200,
      data: {
        ...draftInvoice,
        status: 'ISSUED',
        version: 4,
      },
      headers: {},
      correlationId: 'test-correlation',
    });

    await first;

    expect(frame.issuingInvoice()).toBe(false);
  } finally {
    injector.destroy();
  }
});
