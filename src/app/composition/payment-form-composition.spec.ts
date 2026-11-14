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
import { InvoiceDetailHttpPageComponent } from '../billing/pages/invoice-detail-http-page.component';
import { InvoicePaymentHttpPageComponent } from '../billing/pages/invoice-payment-http-page.component';

const invoiceId = '11111111-1111-4111-8111-111111111111';

const apiInvoice = {
  id: invoiceId,
  patientId: '22222222-2222-4222-8222-222222222222',
  invoiceNumber: 'INV-2026-001',
  items: [],
  total: '150000.00',
  balance: '75000.00',
  currency: 'COP',
  status: 'PARTIALLY_PAID',
  version: 3,
};

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

  root.invoiceListMode.set('http');
  root.session.set({
    state: 'authenticated',
    user: { roles: ['SECRETARY_ASSISTANT'] },
  } as never);

  return { root, injector, request, context };
}

it('selects the HTTP payment form only for HTTP invoice payment routes', () => {
  const { root, injector } = setup();

  try {
    expect(root.useHttpPaymentForm()).toBe(true);

    root.invoiceListMode.set('demo');
    expect(root.useHttpPaymentForm()).toBe(false);

    root.invoiceListMode.set('http');
    root.route.set({
      ...root.route(),
      localPath: `/invoices/${invoiceId}`,
    });

    expect(root.useHttpPaymentForm()).toBe(false);
  } finally {
    injector.destroy();
  }
});

it('provides the matching HTTP invoice to the payment form', () => {
  const { root, injector } = setup();

  try {
    root.invoiceDetailReadState.set(
      invoiceDetailReadSuccess(readInvoiceDetail(apiInvoice)),
    );

    const page = runInInjectionContext(
      injector,
      () => new InvoicePaymentHttpPageComponent(),
    );

    page.readState = root.displayedPaymentInvoiceReadState();
    page.canRecordPayments = root.canRecordPayments();

    expect(page.selectedInvoice?.id).toBe(invoiceId);
    expect(page.selectedInvoice?.version).toBe(3);

    root.route.set({
      ...root.route(),
      localPath: '/invoices/33333333-3333-4333-8333-333333333333/payment',
    });

    page.readState = root.displayedPaymentInvoiceReadState();
    expect(page.selectedInvoice).toBeUndefined();
  } finally {
    injector.destroy();
  }
});

it('forwards payment intents from the HTTP form to the composition handler', () => {
  const { root, injector } = setup();

  try {
    const register = vi.spyOn(root, 'registerPayment')
      .mockResolvedValue(undefined);

    root.invoiceDetailReadState.set(
      invoiceDetailReadSuccess(readInvoiceDetail(apiInvoice)),
    );

    const page = runInInjectionContext(
      injector,
      () => new InvoicePaymentHttpPageComponent(),
    );

    page.readState = root.displayedPaymentInvoiceReadState();
    page.canRecordPayments = root.canRecordPayments();
    page.amount = '25000.00';
    page.method = 'CASH';

    page.record.subscribe(intent => root.requestPaymentRegistration(intent));

    page.submit();

    expect(register).toHaveBeenCalledExactlyOnceWith({
      invoiceId,
      amount: '25000.00',
      method: 'CASH',
      expectedVersion: 3,
      idempotencyKey: expect.any(String),
    });
  } finally {
    injector.destroy();
  }
});

it('keeps demo payment data separate from HTTP payment state', () => {
  const { root, injector } = setup();

  try {
    root.invoiceDetailReadState.set(
      invoiceDetailReadSuccess(readInvoiceDetail(apiInvoice)),
    );

    const demoBefore = root.payments.read();

    expect(root.useHttpPaymentForm()).toBe(true);
    expect(root.displayedPaymentInvoiceReadState().invoice?.id)
      .toBe(invoiceId);
    expect(root.payments.read()).toEqual(demoBefore);

    root.invoiceListMode.set('demo');

    expect(root.useHttpPaymentForm()).toBe(false);
    expect(root.selectedInvoice()).toBeUndefined();
  } finally {
    injector.destroy();
  }
});

it('uses the current payment read state instead of an unrelated invoice', () => {
  const { root, injector } = setup();

  try {
    root.invoiceDetailReadState.set(
      invoiceDetailReadSuccess(
        readInvoiceDetail({
          ...apiInvoice,
          id: '33333333-3333-4333-8333-333333333333',
        }),
      ),
    );

    expect(root.displayedPaymentInvoiceReadState()).toEqual({
      status: 'idle',
      invoice: undefined,
    });
  } finally {
    injector.destroy();
  }
});

it('navigates from HTTP invoice detail to the existing payment form', async () => {
  const { root, injector, context } = setup(`/invoices/${invoiceId}`);

  try {
    root.invoiceDetailReadState.set(
      invoiceDetailReadSuccess(readInvoiceDetail(apiInvoice)),
    );

    const detail = new InvoiceDetailHttpPageComponent();
    detail.readState = root.displayedInvoiceDetailReadState();
    detail.canRecordPayments = root.canRecordPayments();

    expect(detail.canPay).toBe(true);

    detail.pay.subscribe(id => {
      void root.openPayment(id);
    });

    detail.requestPayment();

    await vi.waitFor(() => {
      expect(context.navigation.request).toHaveBeenCalledExactlyOnceWith({
        path: `/app/billing/invoices/${invoiceId}/payment`,
      });
    });

    root.route.set({
      ...root.route(),
      localPath: `/invoices/${invoiceId}/payment`,
    });

    expect(root.useHttpPaymentForm()).toBe(true);
    expect(root.displayedPaymentInvoiceReadState().invoice?.id)
      .toBe(invoiceId);
  } finally {
    injector.destroy();
  }
});
