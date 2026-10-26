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

const firstId = '11111111-1111-4111-8111-111111111111';
const secondId = '33333333-3333-4333-8333-333333333333';

function invoice(id: string, version = 3, status = 'DRAFT') {
  return {
    id,
    patientId: '22222222-2222-4222-8222-222222222222',
    items: [],
    total: '150000.00',
    balance: '150000.00',
    currency: 'COP',
    status,
    version,
  };
}

function deferredResponse() {
  let resolve!: (value: unknown) => void;
  const promise = new Promise<unknown>(done => {
    resolve = done;
  });

  return { promise, resolve };
}

function setup() {
  const controller = new AbortController();
  const request = vi.fn();

  const context = {
    route: {
      localPath: `/invoices/${firstId}`,
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
    invoiceDetailReadSuccess(readInvoiceDetail(invoice(firstId))),
  );

  return { frame, injector, controller, request, context };
}

function issuance(id = firstId) {
  return {
    invoiceId: id,
    expectedVersion: 3,
    idempotencyKey: '99999999-9999-4999-8999-999999999999',
  };
}

function success(id: string) {
  return {
    ok: true,
    status: 200,
    data: invoice(id, 4, 'ISSUED'),
  };
}

it('ignores an issuance response after navigating to another invoice', async () => {
  const { frame, injector, request } = setup();
  const pending = deferredResponse();

  try {
    request.mockReturnValue(pending.promise);

    const operation = frame.issueInvoice(issuance());

    frame.route.set({
      ...frame.route(),
      localPath: `/invoices/${secondId}`,
    });
    frame.invoiceDetailReadState.set(
      invoiceDetailReadSuccess(readInvoiceDetail(invoice(secondId))),
    );

    pending.resolve(success(firstId));
    await operation;

    expect(frame.invoiceDetailReadState().invoice?.id).toBe(secondId);
    expect(frame.invoiceDetailReadState().invoice?.status).toBe('DRAFT');
  } finally {
    injector.destroy();
  }
});

it('ignores an issuance response after leaving invoice detail', async () => {
  const { frame, injector, request } = setup();
  const pending = deferredResponse();

  try {
    request.mockReturnValue(pending.promise);

    const operation = frame.issueInvoice(issuance());

    frame.route.set({ ...frame.route(), localPath: '/' });

    pending.resolve(success(firstId));
    await operation;

    expect(frame.invoiceDetailReadState().invoice?.status).toBe('DRAFT');
    expect(frame.issuanceMessage()).toBe('');
  } finally {
    injector.destroy();
  }
});

it('does not publish issuance results after component destruction', async () => {
  const { frame, injector, request, context } = setup();
  const pending = deferredResponse();

  request.mockReturnValue(pending.promise);

  const operation = frame.issueInvoice(issuance());
  injector.destroy();

  pending.resolve(success(firstId));
  await operation;

  expect(frame.invoiceDetailReadState().invoice?.status).toBe('DRAFT');
  expect(context.reportFailure).not.toHaveBeenCalled();
});

it('does not display errors from a request after its route becomes inactive', async () => {
  const { frame, injector, request, context } = setup();
  const pending = deferredResponse();

  try {
    request.mockReturnValue(pending.promise);

    const operation = frame.issueInvoice(issuance());

    frame.route.set({ ...frame.route(), localPath: '/' });

    pending.resolve({ ok: false, status: 503, data: null });
    await operation;

    expect(frame.issuanceMessage()).toBe('');
    expect(context.reportFailure).not.toHaveBeenCalled();
  } finally {
    injector.destroy();
  }
});

it('does not overwrite a newer invoice read with a stale issuance', async () => {
  const { frame, injector, request } = setup();
  const pending = deferredResponse();

  try {
    request.mockReturnValue(pending.promise);

    const operation = frame.issueInvoice(issuance());

    frame.invoiceDetailReadState.set(
      invoiceDetailReadSuccess(
        readInvoiceDetail(invoice(firstId, 5, 'ISSUED')),
      ),
    );

    pending.resolve(success(firstId));
    await operation;

    expect(frame.invoiceDetailReadState().invoice?.version).toBe(5);
    expect(frame.invoiceDetailReadState().invoice?.status).toBe('ISSUED');
  } finally {
    injector.destroy();
  }
});
